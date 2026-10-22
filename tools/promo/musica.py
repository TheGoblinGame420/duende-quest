"""Musica ORIGINAL del video promocional: un loop chiptune de 30 s.

    python tools/promo/musica.py [salida.wav]

Compuesta aqui mismo (sin samples): pulso 25% para la melodia, pulso 12,5%
para el arpegio, triangulo para el bajo y ruido para la bateria. 150 BPM
(un tiempo = 0,4 s, un compas = 1,6 s): el montaje corta en esos tiempos.
Estructura: A (0-6,4) B (6,4-12,8) A' (12,8-19,2) B' (19,2-25,6) y cierre
(25,6-30) con acordes largos y un golpe final para la tarjeta.
No usa audio/bg_music.ogg (licencia desconocida).
"""
import sys
import wave
import numpy as np

SR = 44100
BPM = 150
T = 60 / BPM          # un tiempo
C8 = T / 2            # una corchea
DUR = 30.0
N = int(SR * DUR)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def nota(m):
    """'A4' -> midi"""
    nombres = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n = nombres[m[0]]
    i = 1
    if m[1] == '#':
        n += 1
        i = 2
    return 12 * (int(m[i:]) + 1) + n


def env(n, a=0.004, d=0.08, s=0.6, r=0.03):
    t = np.arange(n) / SR
    e = np.ones(n) * s
    ai = int(a * SR)
    di = int((a + d) * SR)
    e[:ai] = np.linspace(0, 1, max(1, ai))[:len(e[:ai])]
    if di > ai:
        e[ai:di] = np.linspace(1, s, di - ai)[:len(e[ai:di])]
    ri = int(r * SR)
    if ri and n > ri:
        e[-ri:] *= np.linspace(1, 0, ri)
    return e


def pulso(f, n, duty=0.25, vib=0.0):
    t = np.arange(n) / SR
    fase = np.cumsum(np.full(n, f) * (1 + vib * np.sin(2 * np.pi * 6 * t) * np.clip(t * 4 - 0.6, 0, 1))) / SR
    return np.where((fase % 1) < duty, 1.0, -1.0)


def triangulo(f, n):
    t = np.arange(n) / SR
    fase = (f * t) % 1
    return 4 * np.abs(fase - 0.5) - 1


pista = {k: np.zeros(N) for k in ('lead', 'arp', 'bajo', 'bat', 'pad')}


def poner(nombre, ini, sen, vol):
    i = int(ini * SR)
    if i >= N:
        return
    sen = sen[:N - i]
    pista[nombre][i:i + len(sen)] += sen * vol


# ── Armonia: Am F C G (i VI III VII), un acorde por compas ──
ACORDES = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']]
BAJOS = ['A2', 'F2', 'C2', 'G2']

# ── Melodias (corcheas; '.' = silencio, '-' = sostener la anterior) ──
MEL_A = [
    'A4 . C5 E5 . D5 C5 A4', 'C5 . A4 F4 - G4 A4 .',
    'E5 . G5 E5 . D5 C5 D5', 'B4 . D5 G5 - F5 E5 D5',
]
MEL_B = [
    'E5 E5 . A5 - G5 E5 .', 'F5 - E5 C5 . A4 C5 .',
    'G5 - E5 C5 . E5 G5 C6', 'B5 - G5 D5 . B4 D5 G5',
]


def tocar_melodia(compases, ini_compas, octava=0, vol=0.22, duty=0.25):
    for b, linea in enumerate(compases):
        pasos = linea.split()
        k = 0
        while k < len(pasos):
            p = pasos[k]
            if p in '.-':
                k += 1
                continue
            largo = 1
            while k + largo < len(pasos) and pasos[k + largo] == '-':
                largo += 1
            n = int(C8 * largo * SR)
            m = nota(p) + 12 * octava
            s = pulso(hz(m), n, duty, vib=0.004) * env(n, d=0.1, s=0.55, r=0.02)
            poner('lead', (ini_compas + b) * 4 * T + k * C8, s, vol)
            k += largo


def kick(t0, vol=0.9):
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    f = 150 * np.exp(-t * 28) + 45
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18)
    poner('bat', t0, s, vol)


rng = np.random.default_rng(7)


def ruido(t0, largo, caida, vol, brillo=1.0):
    n = int(largo * SR)
    t = np.arange(n) / SR
    s = rng.uniform(-1, 1, n)
    if brillo > 1:   # paso alto barato: diferencia
        s = np.diff(np.concatenate([[0], s]))
    s *= np.exp(-t * caida)
    poner('bat', t0, s, vol)


def snare(t0, vol=0.45):
    ruido(t0, 0.16, 22, vol)
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    poner('bat', t0, np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30), vol * 0.6)


def hat(t0, vol=0.13, abierto=False):
    ruido(t0, 0.12 if abierto else 0.04, 18 if abierto else 90, vol, brillo=2)


TOTAL_COMPASES = 16
for b in range(TOTAL_COMPASES):
    t0 = b * 4 * T
    ac = ACORDES[b % 4]
    # Bajo: corcheas con salto de octava (empuje constante).
    for k in range(8):
        m = nota(BAJOS[b % 4]) + (12 if k % 2 else 0)
        n = int(C8 * 0.9 * SR)
        poner('bajo', t0 + k * C8, triangulo(hz(m), n) * env(n, d=0.05, s=0.8, r=0.01), 0.42)
    # Arpegio: semicorcheas sobre el acorde, una octava arriba.
    notas = [nota(x) + 12 for x in ac]
    patron = [0, 1, 2, 1] * 4
    for k in range(16):
        n = int(C8 / 2 * 0.85 * SR)
        s = pulso(hz(notas[patron[k]]), n, 0.125) * env(n, d=0.04, s=0.4, r=0.01)
        poner('arp', t0 + k * C8 / 2, s, 0.085 if b >= 1 else 0.06)
    # Bateria: bombo en 1 y 3 (+ empuje), caja en 2 y 4, hi-hat en corcheas.
    for k in range(4):
        if k in (0, 2):
            kick(t0 + k * T)
        else:
            snare(t0 + k * T)
    kick(t0 + 3.5 * T, 0.6)
    for k in range(8):
        hat(t0 + k * C8, 0.15 if k % 2 else 0.1, abierto=(k == 7 and b % 2 == 1))
    # Redoble al final de cada frase de 4 compases.
    if b % 4 == 3:
        for k in range(4):
            snare(t0 + 3 * T + k * T / 4, 0.25 + 0.06 * k)

tocar_melodia(MEL_A, 0)
tocar_melodia(MEL_B, 4)
tocar_melodia(MEL_A, 8, octava=0, vol=0.2)
tocar_melodia(MEL_A, 8, octava=1, vol=0.08, duty=0.125)   # doblada arriba
tocar_melodia(MEL_B, 12, vol=0.22)
tocar_melodia(MEL_B, 12, octava=-1, vol=0.07, duty=0.5)

# ── Cierre (25,6-30 s): acordes largos C - G - Am y golpe final ──
fin0 = TOTAL_COMPASES * 4 * T
cierre = [(['C4', 'E4', 'G4', 'C5'], 'C2', fin0, 2 * T), (['B3', 'D4', 'G4', 'D5'], 'G2', fin0 + 2 * T, 2 * T),
          (['A3', 'C4', 'E4', 'A4'], 'A1', fin0 + 4 * T, DUR - (fin0 + 4 * T))]
for ac, bajo, t0, largo in cierre:
    n = int(largo * SR)
    for x in ac:
        s = pulso(hz(nota(x)), n, 0.25, vib=0.006) * env(n, d=0.25, s=0.45, r=min(0.6, largo * 0.5))
        poner('pad', t0, s, 0.075)
    poner('bajo', t0, triangulo(hz(nota(bajo)), n) * env(n, d=0.2, s=0.7, r=min(0.6, largo * 0.5)), 0.45)
    kick(t0, 0.8)
    ruido(t0, 0.9, 4, 0.12, brillo=2)   # platillo
# Arpegio suave por encima del cierre
for k in range(int((DUR - fin0) / (C8 / 2)) - 4):
    t0 = fin0 + k * C8 / 2
    ac = cierre[0][0] if t0 < fin0 + 2 * T else cierre[1][0] if t0 < fin0 + 4 * T else cierre[2][0]
    n = int(C8 / 2 * 0.8 * SR)
    m = nota(ac[[0, 1, 2, 3, 2, 1][k % 6]]) + 12
    poner('arp', t0, pulso(hz(m), n, 0.125) * env(n, d=0.04, s=0.3, r=0.01), 0.05 * max(0.2, 1 - k / 40))

# ── Mezcla estereo ──
izq = pista['lead'] * 0.95 + pista['arp'] * 0.65 + pista['bajo'] + pista['bat'] * 0.95 + pista['pad'] * 1.0
der = pista['lead'] * 0.95 + pista['arp'] * 1.15 + pista['bajo'] + pista['bat'] * 1.0 + pista['pad'] * 0.9
# eco corto en el lead (ensancha sin ensuciar)
eco = int(0.21 * SR)
der[eco:] += pista['lead'][:-eco] * 0.18
izq[eco * 2:] += pista['lead'][:-eco * 2] * 0.1
mezcla = np.stack([izq, der], axis=1)
# fundido de salida en los ultimos 0,5 s
mezcla[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))[:, None]
mezcla = np.tanh(mezcla * 1.1)
mezcla /= np.max(np.abs(mezcla)) / 0.89

salida = sys.argv[1] if len(sys.argv) > 1 else 'musica.wav'
with wave.open(salida, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mezcla * 32767).astype('<i2').tobytes())
print('musica:', salida, f'{DUR:.1f} s')
