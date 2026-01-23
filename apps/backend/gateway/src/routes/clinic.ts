import express from 'express';
import { supabase } from '../config/database';
import { z } from 'zod';

const router = express.Router();

// Middleware to verify if user is a clinic admin
const verifyClinicAdmin = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        // Verify token and get user
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Check if user is clinica_admin
        const { data: medico, error: medicoError } = await supabase
            .from('medicos')
            .select('id, clinica_id, clinica_admin')
            .eq('user_auth', user.id)
            .single();

        if (medicoError || !medico) {
            return res.status(403).json({ error: 'Perfil de médico não encontrado' });
        }

        if (!medico.clinica_admin || !medico.clinica_id) {
            return res.status(403).json({ error: 'Acesso negado: Requer privilégios de administrador da clínica' });
        }

        // Attach clinic info to request
        req.user = user;
        req.medico = medico;
        next();
    } catch (error) {
        console.error('Erro no middleware de admin:', error);
        return res.status(500).json({ error: 'Erro interno no servidor' });
    }
};

// Validation schema for registering a doctor
const registerDoctorSchema = z.object({
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email: z.string().email('Email inválido'),
});

// POST /api/clinic/registry-doctor
router.post('/registry-doctor', verifyClinicAdmin, async (req: any, res: any) => {
    try {
        // 1. Validate Input
        const { name, email } = registerDoctorSchema.parse(req.body);
        const { clinica_id } = req.medico;

        // 2. Create User in Supabase Auth
        const defaultPassword = 'meuprimeiroacesso_123456789';

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
                name,
                role: 'doctor', // Standard doctor role
                invited_by: req.user.id
            }
        });

        if (authError) {
            console.error('Erro ao criar usuário Auth:', authError);
            return res.status(400).json({ error: `Erro ao criar usuário: ${authError.message}` });
        }

        if (!authData.user) {
            return res.status(500).json({ error: 'Usuário não foi criado corretamente' });
        }

        // 3. Update the automatically created 'medicos' record
        // The trigger 'sync_auth_user_to_medicos' should have run by now

        // We update it to link to the clinic and set 'primeiro_acesso'
        // Give a small delay to ensure trigger execution if needed, although usually synchronous in Postgres
        // But since we are calling from Node, let's just update based on user_auth

        const { error: updateError } = await supabase
            .from('medicos')
            .update({
                clinica_id: clinica_id,
                primeiro_acesso: true, // ✅ Flag for first access reset
                name: name // Ensure name is correct
            })
            .eq('user_auth', authData.user.id);

        if (updateError) {
            console.error('Erro ao atualizar médico:', updateError);
            // Rollback? Deleting the user might be dangerous if partial state.
            // For now, return error but user exists.
            return res.status(500).json({
                error: 'Usuário criado, mas erro ao vincular à clínica',
                details: updateError.message
            });
        }

        return res.status(201).json({
            message: 'Médico cadastrado com sucesso',
            doctor: {
                id: authData.user.id,
                email: authData.user.email,
                name
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Erro ao cadastrar médico:', error);
        return res.status(500).json({ error: 'Erro interno ao cadastrar médico' });
    }
});

export default router;
