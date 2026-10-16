#!/bin/sh
# Current scanner invokes clamscan-compatible options; stream avoids widening
# clamd filesystem permissions and works with systemd PrivateTmp quarantine.
exec /usr/bin/clamdscan --stream "$@"
