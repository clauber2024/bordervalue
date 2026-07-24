$ErrorActionPreference = "Stop"

$dockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$testsPassed = $false

if (-not (Test-Path $dockerPath)) {
    Write-Host "ERRO: Docker nao encontrado no caminho fixo:"
    Write-Host $dockerPath
    Write-Host "Confirme que o Docker Desktop esta instalado nesse local."
    exit 1
}

$pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
    Write-Host "ERRO: Python nao encontrado no PATH."
    Write-Host "Abra um PowerShell com Python habilitado antes de executar este script."
    exit 1
}

$pythonPath = $pythonCommand.Source

Push-Location $PSScriptRoot

try {
    Write-Host "Subindo o PostgreSQL de testes via Docker Compose na porta 5433..."
    & $dockerPath compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao subir os containers com Docker Compose."
    }

    Write-Host "Aguardando 15 segundos para o PostgreSQL aceitar conexoes..."
    Start-Sleep -Seconds 15

    $env:PGHOST = "localhost"
    $env:PGPORT = "5433"
    $env:PGDATABASE = "border_value_db"
    $env:PGUSER = "border_user"
    $env:PGPASSWORD = "border_password"
    $env:DB_CONFIG = "dbname=border_value_db user=border_user password=border_password host=localhost port=5433"

    Write-Host "Executando testes SQL na porta 5433..."
    & $pythonPath -m pytest tests/test_sql_logic.py --verbose
    if ($LASTEXITCODE -eq 0) {
        $testsPassed = $true
    }
} catch {
    Write-Host "ERRO: $($_.Exception.Message)"
} finally {
    Write-Host "Limpando containers de teste..."
    & $dockerPath compose down
    Pop-Location
}

Write-Host "--------------------------------------------------------"
if ($testsPassed) {
    Write-Host "SUCESSO: A logica SQL esta validada na porta 5433."
    Write-Host "--------------------------------------------------------"
    exit 0
}

Write-Host "FALHA: Os testes falharam ou o ambiente nao subiu corretamente."
Write-Host "--------------------------------------------------------"
exit 1
