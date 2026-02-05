
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectTable() {
    console.log('Inspecting s_agente_mentalidade_2...');
    try {
        const { data, error } = await supabase
            .from('s_agente_mentalidade_2')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log('COLUMNS FOUND:', JSON.stringify(Object.keys(data[0])));
        } else {
            console.log('Table is empty or no access.');
        }
    } catch (err) {
        console.error('Exception:', err);
    }
}

inspectTable();
