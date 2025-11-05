import { Agent } from '@smythos/sdk';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';

const { Pool } = pg;

// Configuration
const PORT = process.env.PORT || 9005;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection to existing container
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'koopjesjacht',
  user: process.env.DB_USER || 'koopjesjacht',
  password: process.env.DB_PASSWORD || 'koopjesjacht',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database schema
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS clues (
        clue_id UUID PRIMARY KEY,
        hunt_id UUID,
        venue_id UUID,
        venue_name VARCHAR(255) NOT NULL,
        venue_type VARCHAR(100),
        difficulty_level INTEGER DEFAULT 3 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
        clue_text TEXT NOT NULL,
        hint TEXT,
        solution VARCHAR(255),
        hunt_theme VARCHAR(100),
        ai_generated BOOLEAN DEFAULT false,
        context_data JSONB,
        order_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_clues_hunt_id ON clues(hunt_id);
      CREATE INDEX IF NOT EXISTS idx_clues_venue_id ON clues(venue_id);
      CREATE INDEX IF NOT EXISTS idx_clues_created_at ON clues(created_at DESC);
      
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      DROP TRIGGER IF EXISTS update_clues_updated_at ON clues;
      CREATE TRIGGER update_clues_updated_at
          BEFORE UPDATE ON clues
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Clue generation functions
function generateClueByDifficulty(
  name: string,
  type: string,
  location: string,
  difficulty: number,
  theme?: string
): { text: string; hint: string; solution: string } {
  const templates: Record<number, any> = {
    1: {
      text: `Find the ${type} called "${name}". Look for the sign with this name!`,
      hint: `It's a ${type} in the area`,
      solution: name
    },
    2: {
      text: `Where hungry travelers seek comfort and joy, ${name.split(' ')[0]} welcomes all to employ.`,
      hint: `Look for a ${type} with "${name.split(' ')[0]}" in the name`,
      solution: name
    },
    3: {
      text: generateMediumClue(name, type),
      hint: `Count the letters in "${name.split(' ')[0]}" for a clue`,
      solution: name
    },
    4: {
      text: generateHardClue(name, type, theme),
      hint: `Think about what makes this ${type} unique`,
      solution: name
    },
    5: {
      text: generateCrypticClue(name, type),
      hint: `Decode the hidden message in the clue`,
      solution: name
    }
  };
  return templates[difficulty] || templates[3];
}

function generateMediumClue(name: string, type: string): string {
  const firstLetter = name.charAt(0);
  const wordCount = name.split(' ').length;
  return `Seek a ${type} where ${wordCount === 1 ? 'one word' : `${wordCount} words`} tell the tale, beginning with '${firstLetter}' without fail. A place of flavor, warmth, and care, find the answer waiting there.`;
}

function generateHardClue(name: string, type: string, theme?: string): string {
  const nameLength = name.replace(/\s/g, '').length;
  const vowels = (name.match(/[aeiou]/gi) || []).length;
  if (theme === 'historical') {
    return `In ${nameLength} letters lies the key, where ${vowels} vowels set history free. A ${type} of tales from days gone by, beneath its roof, the past won't die.`;
  }
  return `${nameLength} steps from mystery to truth, ${vowels} vowels guard eternal youth. This ${type} holds secrets in its name, seek it out to win the game.`;
}

function generateCrypticClue(name: string, type: string): string {
  const reversed = name.split('').reverse().join('');
  const firstThree = name.substring(0, 3).toUpperCase();
  return `When "${firstThree}" meets the sky, and backwards "${reversed.substring(0, 3)}" catches the eye. A ${type} exists where puzzles play, solve this riddle to find your way.`;
}

function generateContextualClue(
  name: string,
  description: string,
  neighborhood: string,
  specialty: string,
  difficulty: number
): { text: string; hint: string; solution: string } {
  const templates = [
    `In ${neighborhood}, where ${specialty} reigns supreme, find the place where quality is not just a dream. Look for ${name}'s welcoming door, where flavors dance and spirits soar.`,
    `Among ${neighborhood}'s finest, one stands tall, famous for ${specialty} that enthralls all. The name you seek is whispered with pride, ${name} awaits on the other side.`,
    `Where ${specialty} meets ${neighborhood}'s charm, ${name} keeps tradition warm. Seek the spot where locals know, quality and taste both flow.`
  ];
  return {
    text: templates[difficulty % templates.length],
    hint: `Famous for ${specialty} in ${neighborhood}`,
    solution: name
  };
}

// Initialize SmythOS Agent
let clueAgent: Agent;

async function initializeAgent() {
  console.log('🤖 Initializing SmythOS Clue Generator Agent...');
  
  clueAgent = new Agent({
    name: 'ClueGeneratorAgent',
    model: 'gpt-4o',
    behavior: `You are an expert at creating engaging treasure hunt clues.
    You can generate clues of varying difficulty levels (1-5) for different venues.
    You understand context like venue names, types, neighborhoods, and themes.
    You create clever, creative riddles that are challenging but solvable.`,
  });

  // Add skills to the agent
  clueAgent.addSkill({
    name: 'generateClue',
    description: 'Generate a single clue for a venue',
    ai_exposed: true,
    process: async ({ venue_name, venue_type, location, difficulty_level = 3, hunt_theme }: any) => {
      const clue = generateClueByDifficulty(venue_name, venue_type || 'restaurant', location, difficulty_level, hunt_theme);
      const clue_id = uuidv4();
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO clues (clue_id, venue_name, venue_type, difficulty_level, clue_text, hint, solution, hunt_theme) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [clue_id, venue_name, venue_type, difficulty_level, clue.text, clue.hint, clue.solution, hunt_theme]
        );
      } finally {
        client.release();
      }
      return { clue_id, venue_name, venue_type, difficulty_level, clue_text: clue.text, hint: clue.hint, solution: clue.solution };
    }
  });

  clueAgent.addSkill({
    name: 'generateBatch',
    description: 'Generate multiple clues for venues',
    ai_exposed: true,
    process: async ({ venues, hunt_theme, difficulty_level = 3, hunt_id }: any) => {
      const client = await pool.connect();
      const generatedClues = [];
      try {
        for (let index = 0; index < venues.length; index++) {
          const venue = venues[index];
          const clue = generateClueByDifficulty(venue.name, venue.type || 'restaurant', venue.location, venue.difficulty_level || difficulty_level, hunt_theme);
          const clue_id = uuidv4();
          await client.query(
            `INSERT INTO clues (clue_id, hunt_id, venue_id, venue_name, venue_type, difficulty_level, clue_text, hint, solution, hunt_theme, order_number) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [clue_id, hunt_id || null, venue.id || null, venue.name, venue.type, venue.difficulty_level || difficulty_level, clue.text, clue.hint, clue.solution, hunt_theme, index + 1]
          );
          generatedClues.push({ clue_id, venue_id: venue.id, venue_name: venue.name, order: index + 1, clue_text: clue.text, hint: clue.hint, solution: clue.solution });
        }
      } finally {
        client.release();
      }
      return { count: generatedClues.length, clues: generatedClues };
    }
  });

  console.log('✅ SmythOS Agent initialized with skills');
}

// HTTP API Endpoints
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({
      status: 'healthy',
      service: 'clue-generator-agent',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'clue-generator-agent',
      database: 'disconnected',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/generate-clue', async (req, res) => {
  try {
    const { venue_name, venue_type, location, difficulty_level = 3, hunt_theme } = req.body;
    
    if (!venue_name) {
      return res.status(400).json({ error: 'venue_name is required' });
    }

    const result = await clueAgent.call('generateClue', {
      venue_name, venue_type, location, difficulty_level, hunt_theme
    });

    console.log(`[Clue Generator] Generated clue for ${venue_name}`);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Clue Generator] Error:', error);
    res.status(500).json({ error: 'Failed to generate clue' });
  }
});

app.post('/api/generate-batch', async (req, res) => {
  try {
    const { venues, hunt_theme, difficulty_level = 3, hunt_id } = req.body;
    
    if (!venues || !Array.isArray(venues)) {
      return res.status(400).json({ error: 'venues array is required' });
    }

    const result = await clueAgent.call('generateBatch', {
      venues, hunt_theme, difficulty_level, hunt_id
    });

    console.log(`[Clue Generator] Generated ${result.count} clues in batch`);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Clue Generator] Batch error:', error);
    res.status(500).json({ error: 'Failed to generate batch' });
  }
});

app.get('/api/clues/:hunt_id', async (req, res) => {
  try {
    const { hunt_id } = req.params;
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM clues WHERE hunt_id = $1 ORDER BY order_number',
        [hunt_id]
      );
      res.json({ hunt_id, count: result.rows.length, data: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Clue Generator] Error fetching clues:', error);
    res.status(500).json({ error: 'Failed to fetch clues' });
  }
});

app.get('/api/clue/:clue_id', async (req, res) => {
  try {
    const { clue_id } = req.params;
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM clues WHERE clue_id = $1', [clue_id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Clue not found' });
      }
      res.json({ data: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Clue Generator] Error fetching clue:', error);
    res.status(500).json({ error: 'Failed to fetch clue' });
  }
});

app.put('/api/clue/:clue_id', async (req, res) => {
  try {
    const { clue_id } = req.params;
    const updates = req.body;
    const client = await pool.connect();
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'clue_id' && key !== 'created_at') {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      values.push(clue_id);
      const query = `UPDATE clues SET ${updateFields.join(', ')} WHERE clue_id = $${paramIndex} RETURNING *`;
      const result = await client.query(query, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Clue not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Clue Generator] Error updating clue:', error);
    res.status(500).json({ error: 'Failed to update clue' });
  }
});

// Start server
async function start() {
  try {
    await initDatabase();
    await initializeAgent();
    
    app.listen(PORT, () => {
      console.log(`✅ Clue Generator Agent running on port ${PORT}`);
      console.log(`   HTTP API: http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, shutting down...');
  await pool.end();
  process.exit(0);
});

start();
