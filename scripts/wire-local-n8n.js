const Database = require('better-sqlite3');
const db = new Database('./data/mission-control.db');

const mapping = {
  'X/Twitter Ingestion Pipeline': '05-twitter-ingestion',
  'Content Discovery Pipeline': '04-content-discovery',
  'Blog Content Pipeline': '06-blog-content',
  'Video Idea Pipeline': '14-video-ideas',
  'Kalshi Market Scanner': '07-kalshi-scanner',
  'Position Monitor & Exit': '08-position-monitor',
  'Revenue Dashboard Aggregator': '09-revenue-aggregator',
  'Amazon Affiliate Pipeline': '10-amazon-affiliate',
  'Cost Monitor & Optimizer': '03-cost-monitor',
  'Agent Health Monitor': '01-agent-health-monitor',
  'Daily CEO Briefing': '02-daily-ceo-briefing',
  'Knowledge Base Sync': '11-kb-sync',
  'Exec Council Trigger': '12-exec-council',
  'Hourly Backup': '13-hourly-backup'
};

const stmt = db.prepare('UPDATE workflows SET n8n_workflow_id = ? WHERE name = ?');
let updated = 0;
for (const [name, n8nId] of Object.entries(mapping)) {
  const r = stmt.run(n8nId, name);
  console.log(r.changes ? '✅' : '❌', name, '->', n8nId);
  updated += r.changes;
}
console.log('\nTotal updated:', updated, '/ 14');
db.close();
