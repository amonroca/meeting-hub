<#
.SYNOPSIS
    Testa os lembretes de reuniões/entrevistas enviando mensagens apenas para o chat_id informado.

.DESCRIPTION
    Chama a Edge Function send-scheduled-reminders com testChatId, fazendo com que
    todas as mensagens sejam enviadas apenas para o número Telegram especificado.
    Todo o fluxo de filtragem (tipos de reunião, usuários cadastrados) roda normalmente.

    Para que o teste encontre eventos, crie um evento no Google Calendar na data correta:
      - 4days : evento daqui a 4 dias
      - 1day  : evento amanhã
      - 1hour : entrevista (com campo "Entrevistador" no Calendar) na próxima hora cheia

    Para descobrir seu chat_id do Telegram, envie /start para @userinfobot.

.PARAMETER TestChatId
    Chat ID do Telegram para onde as mensagens de teste serão enviadas.

.PARAMETER ReminderType
    Tipo de lembrete: '4days', '1day' ou '1hour'. Padrão: '4days'.

.PARAMETER SupabaseUrl
    URL do projeto Supabase. Lida de $env:VITE_SUPABASE_URL se não informada.

.PARAMETER ServiceRoleKey
    Chave service_role do Supabase. Lida de $env:SUPABASE_SERVICE_ROLE_KEY se não informada.
    NUNCA armazene este valor em arquivo — defina como variável de sessão:
        $env:SUPABASE_SERVICE_ROLE_KEY = "sua-chave"

.EXAMPLE
    $env:SUPABASE_SERVICE_ROLE_KEY = "sua-chave-aqui"
    .\scripts\test-reminders.ps1 -TestChatId 123456789 -ReminderType 4days

.EXAMPLE
    .\scripts\test-reminders.ps1 -TestChatId 123456789 -ReminderType 1hour -SupabaseUrl "https://xxx.supabase.co"
#>

param(
    [Parameter(Mandatory)]
    [long]$TestChatId,

    [ValidateSet('4days', '1day', '1hour')]
    [string]$ReminderType = '4days',

    [string]$SupabaseUrl = $env:VITE_SUPABASE_URL,
    [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

if (-not $SupabaseUrl) {
    Write-Error "Informe a URL do Supabase via -SupabaseUrl ou defina `$env:VITE_SUPABASE_URL"
    exit 1
}
if (-not $ServiceRoleKey) {
    Write-Error "Informe a service_role key via -ServiceRoleKey ou defina `$env:SUPABASE_SERVICE_ROLE_KEY na sessao PowerShell"
    exit 1
}

$FunctionUrl = "$($SupabaseUrl.TrimEnd('/'))/functions/v1/send-scheduled-reminders"

$Body = @{
    testChatId   = $TestChatId
    reminderType = $ReminderType
} | ConvertTo-Json -Compress

$Headers = @{
    'Content-Type'  = 'application/json'
    'Authorization' = "Bearer $ServiceRoleKey"
    'apikey'        = $ServiceRoleKey
}

Write-Host ""
Write-Host "Disparando lembrete de teste..." -ForegroundColor Cyan
Write-Host "  Tipo     : $ReminderType"
Write-Host "  Chat ID  : $TestChatId"
Write-Host "  Endpoint : $FunctionUrl"
Write-Host ""

try {
    $Response = Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers $Headers -Body $Body -ErrorAction Stop
    Write-Host "Resposta da função:" -ForegroundColor Green
    $Response | ConvertTo-Json -Depth 6
}
catch {
    $StatusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Erro HTTP $StatusCode" -ForegroundColor Red
    try {
        $Detail = $_.ErrorDetails.Message | ConvertFrom-Json
        $Detail | ConvertTo-Json -Depth 4
    }
    catch {
        Write-Host $_.ErrorDetails.Message
    }
}
