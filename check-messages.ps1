# Quick script to check if messages are being stored
$env:PGPASSWORD="Ranjeesh83#"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U slack_user -d slack_dev_db -c "SELECT COUNT(*) as total_messages, MAX(created_at) as latest_message FROM message_events;"

