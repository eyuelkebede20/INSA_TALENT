import fs from 'fs';
import path from 'path';
import { db } from '../src/db/index.js';
import { players } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

// Simple CSV parser
function parseCSV(csvText: string) {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    const matches = Array.from(lines[i].matchAll(regex));
    
    if (matches.length > 0) {
      const row: any = {};
      matches.forEach((match, index) => {
        if (index < headers.length) {
          const val = match[1] !== undefined ? match[1] : match[2];
          row[headers[index]] = val ? val.trim() : '';
        }
      });
      results.push(row);
    }
  }
  return results;
}

async function importPlayers() {
  try {
    const csvPath = path.resolve(process.cwd(), '../players (9).csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const records = parseCSV(csvData);

    // Extract unique team IDs (team numbers)
    const teamNumbers = new Set<number>();
    for (const record of records) {
      if (record.Team_ID) {
        teamNumbers.add(parseInt(record.Team_ID, 10));
      }
    }

    const { teams } = await import('../src/db/schema.js');
    
    // Insert unique teams
    console.log(`Ensuring ${teamNumbers.size} teams exist in the database...`);
    for (const tNum of Array.from(teamNumbers).sort((a,b)=>a-b)) {
      try {
        await db.insert(teams).values({
          teamNumber: tNum,
          isLocked: false,
        }).onConflictDoNothing({ target: teams.teamNumber });
      } catch (err: any) {
        // Fallback if target is needed or constraint fails
        console.log(`Team ${tNum} might already exist or error: ${err.message}`);
      }
    }

    // Fetch all teams to map teamNumber to team.id
    const allTeams = await db.select().from(teams);
    const teamNumberToIdMap: Record<number, number> = {};
    for (const t of allTeams) {
      teamNumberToIdMap[t.teamNumber] = t.id;
    }

    console.log(`Starting to import ${records.length} players...`);
    let successCount = 0;
    let failCount = 0;

    for (const record of records) {
      if (!record.Name || !record.Email) continue; 
      
      try {
        const tNum = record.Team_ID ? parseInt(record.Team_ID, 10) : null;
        const mappedTeamId = tNum ? teamNumberToIdMap[tNum] : null;

        await db.insert(players).values({
          realName: record.Name,
          email: record.Email,
          insaCode: record.INSA_ID || null,
          lichessUsername: record.Lichess || null,
          chesscomUsername: record.Chesscom || null,
          currentRating: parseInt(record.Rating, 10) || 0,
          tier: (record.Tier as 'ADVANCED' | 'MID' | 'BEGINNER') || 'BEGINNER',
          teamId: mappedTeamId,
          isLeader: false,
        }).onConflictDoNothing({ target: players.email });
        successCount++;
        if (successCount % 50 === 0) console.log(`Imported ${successCount} players...`);
      } catch (err: any) {
        failCount++;
        console.error(`Failed to import ${record.Name} (${record.Email}): ${err.message}`);
      }
    }

    console.log(`\nImport completed! Successfully imported: ${successCount}. Failed: ${failCount}.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to read or parse CSV:', error);
    process.exit(1);
  }
}

importPlayers();
