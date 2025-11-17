@echo off
echo ========================================
echo   DEBUG: Why Messages Not Storing
echo ========================================
echo.

echo [1] Checking database connection...
set PGPASSWORD=Ranjeesh83#
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "SELECT 'Database connected' as status, COUNT(*) as existing_messages FROM message_events;" 2>nul
if errorlevel 1 (
    echo ERROR: Cannot connect to database!
    echo Check if PostgreSQL is running.
    pause
    exit /b 1
)

echo.
echo [2] Checking table structure...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "\d message_events;" 2>nul | findstr /C:"event_id" /C:"channel_id" /C:"user_id"
if errorlevel 1 (
    echo WARNING: Could not verify table structure
)

echo.
echo [3] Current message count in database:
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "SELECT COUNT(*) as total_messages, MAX(created_at) as latest_message FROM message_events;"

echo.
echo [4] Checking .env file for SLACK_CHANNEL_ID...
findstr /C:"SLACK_CHANNEL_ID" .env 2>nul
if errorlevel 1 (
    echo WARNING: SLACK_CHANNEL_ID not found in .env
) else (
    echo .env file found with channel ID
)

echo.
echo ========================================
echo   NEXT STEPS:
echo ========================================
echo 1. Check server logs (where npm start is running)
echo    Look for: ^📥 Received event: message^
echo.
echo 2. If NO events in logs:
echo    - Add message.channels to Slack Event Subscriptions
echo    - Reinstall app to workspace
echo    - Verify Request URL is correct
echo.
echo 3. If events received but not saved:
echo    - Check for error messages in server logs
echo    - Verify channel ID matches
echo    - Check if message is from bot (filtered out)
echo.
echo 4. Check Slack Event Logs:
echo    https://api.slack.com/apps ^> Your App ^> Event Subscriptions ^> Event Logs
echo.
pause

