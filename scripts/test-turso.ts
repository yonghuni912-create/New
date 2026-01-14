import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://bbqtest-kunikun.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Njg0MTI1ODQsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.7IEchSW2WRm6BOKSND4EtMbTN19FSboqTBjmo2A9RB8q4CUFnZueQUOsxU1PRzXTjH_-n97D5iT5vEkfsFScAg',
});

async function main() {
  console.log('Testing Turso connection...');
  
  try {
    // Check users
    const users = await client.execute("SELECT id, email, name, role FROM User");
    console.log('Users in database:', users.rows);
    
    // Check countries
    const countries = await client.execute("SELECT id, code, name FROM Country");
    console.log('Countries:', countries.rows);
    
  } catch (error: any) {
    console.error('Error:', error);
  }
}

main();
