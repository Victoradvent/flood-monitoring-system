$ErrorActionPreference = "Stop"
$certDir = Join-Path $PSScriptRoot "..\mosquitto\certs"
$caDir = Join-Path $PSScriptRoot "..\.dev-certs"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required to generate development MQTT certificates."
}
New-Item -ItemType Directory -Force -Path $certDir, $caDir | Out-Null
if (Test-Path (Join-Path $certDir "ca.key")) {
  throw "Remove the legacy mosquitto/certs/ca.key; broker containers must not receive the CA private key."
}
$caKey = Join-Path $caDir "ca.key"
$caCertificate = Join-Path $caDir "ca.crt"
$serverKey = Join-Path $certDir "server.key"
$serverCertificate = Join-Path $certDir "server.crt"
if ((Test-Path $caKey) -ne (Test-Path $caCertificate)) {
  throw "The development CA key and certificate must both exist or both be absent."
}
if ((Test-Path $serverKey) -or (Test-Path $serverCertificate)) {
  throw "Development server key/certificate already exist; remove those generated files before rotating them."
}

if (-not (Test-Path $caKey)) {
  docker run --rm -v "${certDir}:/out" -v "${caDir}:/ca" alpine/openssl req -x509 `
    -newkey rsa:3072 -nodes -keyout /ca/ca.key -out /ca/ca.crt -days 365 `
    -subj "/CN=FMS Development CA" -addext "basicConstraints=critical,CA:TRUE" `
    -addext "keyUsage=critical,keyCertSign,cRLSign"
  if ($LASTEXITCODE -ne 0) { throw "Failed to create development CA." }
}
docker run --rm -v "${certDir}:/out" alpine/openssl req -newkey rsa:2048 -nodes `
  -keyout /out/server.key -out /out/server.csr -subj "/CN=mqtt"
if ($LASTEXITCODE -ne 0) { throw "Failed to create MQTT certificate request." }
$extensionFile = Join-Path $certDir "server-ext.cnf"
@"
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:mqtt,DNS:localhost,IP:127.0.0.1
"@ | Set-Content -Path $extensionFile -NoNewline
docker run --rm -v "${certDir}:/out" -v "${caDir}:/ca" alpine/openssl x509 `
  -req -in /out/server.csr -CA /ca/ca.crt -CAkey /ca/ca.key `
  -CAcreateserial -CAserial /ca/ca.srl -out /out/server.crt -days 90 `
  -extfile /out/server-ext.cnf
if ($LASTEXITCODE -ne 0) { throw "Failed to sign the MQTT server certificate." }
Copy-Item -Force (Join-Path $caDir "ca.crt") (Join-Path $certDir "ca.crt")
Remove-Item (Join-Path $certDir "server.csr"), $extensionFile -Force
Write-Host "Generated SIMULATED DEVELOPMENT MQTT certificates in $certDir"