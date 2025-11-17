# Test script to simulate a Slack message event
Write-Host "Testing Slack Events Endpoint..." -ForegroundColor Cyan
Write-Host ""

$testEvent = @{
    type = "event_callback"
    event = @{
        type = "message"
        channel = "C09SUH2KHK2"
        user = "U123456"
        text = "Test message"
        event_ts = [Math]::Floor([decimal]((Get-Date).ToUniversalTime() - (Get-Date "1970-01-01")).TotalSeconds)
        ts = [Math]::Floor([decimal]((Get-Date).ToUniversalTime() - (Get-Date "1970-01-01")).TotalSeconds)
    }
    event_id = "EvTest_$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json -Depth 10

Write-Host "Sending test event to server..." -ForegroundColor Yellow
Write-Host "Event: $testEvent" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/slack/events" -Method POST -Body $testEvent -ContentType "application/json" -ErrorAction Stop
    Write-Host "✅ Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Check your server logs to see if the event was processed." -ForegroundColor Cyan

