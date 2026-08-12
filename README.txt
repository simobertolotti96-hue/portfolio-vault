PORTFOLIO VAULT V2.1 — SAFE BUILD

Questa build aggiunge:
- backup completamente cifrato con AES-GCM;
- chiave del backup derivata dal PIN con PBKDF2-SHA-256;
- salt casuale per ogni backup;
- ripristino con PIN e verifica della struttura dati;
- conferma prima di sovrascrivere il vault;
- service worker per cache/offline della PWA;
- blocco automatico dopo 5 minuti in background.

Architettura:
- nessun server per i dati finanziari;
- nessun account;
- nessun collegamento a banca, broker o Trusters;
- database locale cifrato;
- backup cifrato.

Nota: una PWA installabile su iPhone richiede HTTPS per il service worker. I dati del portafoglio restano nel browser/dispositivo; il sito serve solo i file dell'app.

Prima dell'uso con dati finanziari reali è consigliato un test di ripristino del backup su un secondo ambiente e, per una versione definitiva, un audit di sicurezza.
