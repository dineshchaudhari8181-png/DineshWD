@echo off
echo Checking message count in database...
echo.
set PGPASSWORD=Ranjeesh83#
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "SELECT COUNT(*) as total_messages FROM message_events;"
echo.
echo If count is 0, messages are not being stored.
echo Check if message.channels event is subscribed in Slack app settings.
pause

