-- 07-pagos-oct.sql (27-oct-2026): una transaccion on-chain solo puede cerrar una orden.
-- Se puede ejecutar mas de una vez. functions/api/helius-verify.js ya lo comprueba en codigo;
-- el indice cierra tambien la carrera entre dos peticiones simultaneas.
CREATE UNIQUE INDEX IF NOT EXISTS sol_orders_txsig_uniq ON sol_orders (tx_signature) WHERE tx_signature IS NOT NULL AND tx_signature <> '';
CREATE UNIQUE INDEX IF NOT EXISTS skin_purchases_txsig_uniq ON skin_purchases (tx_signature) WHERE tx_signature IS NOT NULL AND tx_signature <> '';
