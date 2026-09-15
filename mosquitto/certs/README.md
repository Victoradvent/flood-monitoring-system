# Development MQTT certificates

These certificates are **SIMULATED DEVELOPMENT credentials only**. They are self-signed and must be replaced with certificates issued by the organization's trusted CA before production deployment.

Generate them from the repository root with:

```powershell
./scripts/generate-dev-certs.ps1
```

The generated `ca.crt`, `server.crt`, and `server.key` are intentionally ignored by Git. Do not reuse them outside local testing.