$ErrorActionPreference = "Stop"
$certDir = Join-Path $PSScriptRoot "..\mosquitto\certs"
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

docker run --rm -v "${certDir}:/out" alpine/openssl req -x509 -newkey rsa:2048 -nodes `
  -keyout /out/ca.key -out /out/ca.crt -days 365 -subj "/CN=FMS Development CA"
docker run --rm -v "${certDir}:/out" alpine/openssl req -newkey rsa:2048 -nodes `
  -keyout /out/server.key -out /out/server.csr -subj "/CN=mqtt"
$extensionFile = Join-Path $certDir "server-ext.cnf"
@"
subjectAltName=DNS:mqtt,DNS:localhost,IP:127.0.0.1
"@ | Set-Content -Path $extensionFile -NoNewline
docker run --rm -v "${certDir}:/out" alpine/openssl x509 -req -in /out/server.csr `
  -CA /out/ca.crt -CAkey /out/ca.key -CAcreateserial -out /out/server.crt -days 365 `
  -extfile /out/server-ext.cnf
Remove-Item (Join-Path $certDir "server.csr"), (Join-Path $certDir "ca.srl"), $extensionFile -Force -ErrorAction SilentlyContinue
Write-Host "Generated SIMULATED DEVELOPMENT MQTT certificates in $certDir"