# Lo lanza construir.mjs dentro de Blender: construye una familia y escribe su paquete.
#   blender --background --factory-startup --python tools/blender/_correr.py -- <familia> <carpeta de salida>
import sys, os, runpy
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import dq_lib as dq

args = sys.argv[sys.argv.index('--') + 1:]
familia, salida = args[0], args[1]
dq.limpiar()
runpy.run_path(os.path.join(AQUI, 'modelos', familia + '.py'), run_name='dq_modelos')
if not dq.MODELOS: raise SystemExit('la familia %s no registra modelos (@modelo)' % familia)
dq.exportar(familia, salida)
