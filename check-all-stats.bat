@echo off
echo ========================================
echo   Checking All Statistics in Database
echo ========================================
echo.
set PGPASSWORD=Ranjeesh83#
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "SELECT 'Messages' as metric, COUNT(*) as count FROM message_events UNION ALL SELECT 'Files', COUNT(*) FROM file_events UNION ALL SELECT 'Reactions', COUNT(*) FROM reaction_events UNION ALL SELECT 'Members Joined', COUNT(*) FROM member_events WHERE event_type = 'member_joined_channel' UNION ALL SELECT 'Members Left', COUNT(*) FROM member_events WHERE event_type = 'member_left_channel' ORDER BY metric;"
echo.
echo ========================================
pause

