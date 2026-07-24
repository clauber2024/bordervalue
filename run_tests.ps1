$ErrorActionPreference = "Stop"

$dockerExe = $null
$dockerCandidate = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

if (Test-Path $dockerCandidate) {
    $dockerExe = $dockerCandidate
} else {
    $dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($dockerCommand) {
        $dockerExe = $dockerCommand.Source
    }
}

if (-not $dockerExe) {
    Write-Host "ERRO: Docker CLI nao encontrado."
    Write-Host "Verifique se o Docker Desktop esta instalado ou adicione docker.exe ao PATH."
    exit 1
}

$composeMode = $null
$dockerComposeCommand = Get-Command docker-compose.exe -ErrorAction SilentlyContinue

if ($dockerComposeCommand) {
    $composeMode = "docker-compose"
} else {
    & $dockerExe compose version *> $null
    if ($LASTEXITCODE -eq 0) {
        $composeMode = "docker compose"
    }
}

if (-not $composeMode) {
    Write-Host "ERRO: Docker Compose nao encontrado."
    Write-Host "Instale o plugin Docker Compose ou disponibilize docker-compose.exe no PATH."
    exit 1
}

$pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
    Write-Host "ERRO: Python nao encontrado no PATH."
    Write-Host "Abra um terminal com Python habilitado ou ajuste o PATH antes de executar este script."
    exit 1
}

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    if ($composeMode -eq "docker-compose") {
        & docker-compose @Arguments
    } else {
        & $dockerExe compose @Arguments
    }
}

$testsPassed = $false
$infraStarted = $false

try {
    Write-Host "Verificando Docker..."
    & $dockerExe info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker nao respondeu. Inicie o Docker Desktop e tente novamente."
    }

    Write-Host "Subindo a infraestrutura de testes na porta 5433..."
    Invoke-Compose @("up", "-d")
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao subir os containers."
    }
    $infraStarted = $true

    Write-Host "Aguardando o PostgreSQL inicializar..."
    Start-Sleep -Seconds 10

    $env:PGPORT = "5433"
    $env:DB_CONFIG = "dbname=border_value_db user=border_user password=border_password host=localhost port=5433"

    Write-Host "Executando testes SQL..."
    & python -m pytest tests/test_sql_logic.py --verbose
    if ($LASTEXITCODE -eq 0) {
        $testsPassed = $true
    }
} catch {
    Write-Host "ERRO: $($_.Exception.Message)"
} finally {
    if ($infraStarted) {
        Write-Host "Limpando containers de teste..."
        Invoke-Compose @("down")
    }
}

Write-Host "--------------------------------------------------------"
if ($testsPassed) {
    Write-Host "SUCESSO: A logica SQL esta validada e matematicamente correta."
    Write-Host "--------------------------------------------------------"
    exit 0
}

Write-Host "FALHA: O SQL divergiu dos resultados esperados ou o ambiente nao subiu corretamente."
Write-Host "--------------------------------------------------------"
exit 1
