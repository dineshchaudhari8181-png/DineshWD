# Check all statistics in the database
$env:PGPASSWORD="Ranjeesh83#"
Write-Host "`n📊 Current Database Statistics:`n" -ForegroundColor Cyan

$query = @"
SELECT 'Messages' as metric, COUNT(*) as count, MAX(created_at) as latest FROM message_events
UNION ALL
SELECT 'Files', COUNT(*), MAX(created_at) FROM file_events
UNION ALL
SELECT 'Reactions', COUNT(*), MAX(created_at) FROM reaction_events
UNION ALL
SELECT 'Members Joined', COUNT(*), MAX(created_at) FROM member_events WHERE event_type = 'member_joined_channel'
UNION ALL
SELECT 'Members Left', COUNT(*), MAX(created_at) FROM member_events WHERE event_type = 'member_left_channel'
ORDER BY metric;
"@

& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c $query

Write-Host "`n💡 To check after sending a message, run this script again.`n" -ForegroundColor Yellow

