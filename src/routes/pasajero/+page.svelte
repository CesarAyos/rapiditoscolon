<script lang="ts">
    import { supabase } from '../../components/supabase';
    import { goto } from '$app/navigation';
    import type { AuthError } from '@supabase/supabase-js';
    
    type Genero = 'masculino' | 'femenino' | 'otro' | 'prefiero-no-decir';
    
    // Variables y estados
    let nombre = '';
    let apellido = '';
    let email = '';
    let telefono = '';
    let password = '';
    let confirmPassword = '';
    let genero: Genero = 'masculino';
    let fechaNacimiento = '';
    let aceptaTerminos = false;
    let showPassword = false;
    let errorMessage = '';
    let isLoading = false;
    let successMessage = '';

    const generos = [
      { value: 'masculino', label: 'Masculino' },
      { value: 'femenino', label: 'Femenino' },
      { value: 'otro', label: 'Otro' },
      { value: 'prefiero-no-decir', label: 'Prefiero no decir' }
    ];

    // Función para alternar la visibilidad de la contraseña
    function togglePassword() {
        showPassword = !showPassword;
    }

    // Validación de teléfono con regex
    function validarTelefono(numero: string): boolean {
        const regex = /^(\+?\d{1,3}?[-.\s]?)?(\(\d{1,4}\)|\d{1,4})[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/;
        return regex.test(numero);
    }

    // Verificar si un usuario ya existe en la base de datos
    async function checkUserExists(email: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('pasajero')
            .select('email')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();
            
        if (error) {
            console.error('Error al verificar usuario:', error);
            return false;
        }
        return !!data;
    }

    // Validar todos los inputs
    function validateInputs(): string | null {
        if (password !== confirmPassword) return '¡Las contraseñas no coinciden!';
        if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Por favor ingresa un email válido';
        if (!validarTelefono(telefono)) return 'Por favor ingresa un número de teléfono válido';
        if (!fechaNacimiento) return 'La fecha de nacimiento es requerida';
        if (!aceptaTerminos) return 'Debes aceptar los términos y condiciones';
        return null;
    }

    // Manejar el registro del usuario
    async function handleSubmit() {
        errorMessage = '';
        successMessage = '';
        isLoading = true;

        // Validación inicial
        const validationError = validateInputs();
        if (validationError) {
            errorMessage = validationError;
            isLoading = false;
            return;
        }

        try {
            // Limpiar datos
            const telefonoLimpio = telefono.replace(/\D/g, '');
            const fechaNacimientoISO = new Date(fechaNacimiento).toISOString();

            // Verificar si el usuario ya existe
            const userExists = await checkUserExists(email);
            if (userExists) {
                errorMessage = 'Este correo electrónico ya está registrado. ¿Quieres iniciar sesión?';
                isLoading = false;
                return;
            }

            // Registrar usuario en Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password: password,
                options: {
                    data: {
                        full_name: `${nombre.trim()} ${apellido.trim()}`,
                        phone: telefonoLimpio,
                        gender: genero,
                        birth_date: fechaNacimientoISO,
                    },
                },
            });

            if (authError) throw authError;

            // Verificar registro exitoso
            if (!authData?.user?.id) {
                throw new Error('No se recibió el ID del usuario registrado desde Supabase Auth');
            }

            // Insertar usuario en la tabla 'pasajero'
            const { error: dbError } = await supabase
                .from('pasajero')
                .insert({
                    user_id: authData.user.id, // Vincular con Supabase Auth
                    nombre: nombre.trim(),
                    apellido: apellido.trim(),
                    email: email.trim().toLowerCase(),
                    telefono: telefonoLimpio,
                    genero: genero,
                    fecha_nacimiento: fechaNacimientoISO,
                    acepta_terminos: aceptaTerminos,
                    created_at: new Date().toISOString(),
                });

            if (dbError) {
                // Eliminar usuario de Supabase Auth si falla el registro en la tabla
                await supabase.auth.admin.deleteUser(authData.user.id);
                throw dbError;
            }

            // Mensaje de éxito
            successMessage = '¡Registro exitoso! Por favor verifica tu correo electrónico.';
            goto('/auth');
        } catch (error: unknown) {
            console.error('Error en el registro:', error);

            // Manejo de errores
            if (isAuthError(error)) {
                if (error.message.includes('User already registered')) {
                    errorMessage = 'Este email ya está registrado. ¿Quieres iniciar sesión?';
                } else if (error.status === 422) {
                    errorMessage = 'Error de validación: Verifica tus datos';
                } else {
                    errorMessage = `Error de autenticación: ${error.message}`;
                }
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = (error as Error).message;
            } else {
                errorMessage = 'Error inesperado. Por favor intenta nuevamente.';
            }
        } finally {
            isLoading = false;
        }
    }

    // Verificar si un error es de autenticación
    function isAuthError(error: unknown): error is AuthError {
        return typeof error === 'object' && 
               error !== null && 
               'message' in error && 
               'status' in error;
    }
</script>



<!-- El resto del código HTML y CSS permanece igual -->

<div class="wrapper">
	<div class="scroll-container">
		<div class="container animate-fall">
			<h1 class="title">Regístrate como Pasajero</h1>
			<p class="subtitle">Crea tu cuenta en menos de 2 minutos</p>

			<form on:submit|preventDefault={handleSubmit} class="register-form">
				<!-- Nombre completo -->
				<div class="form-row">
					<div class="form-group half-width">
						<label for="nombre">Nombre</label>
						<input id="nombre" type="text" bind:value={nombre} placeholder="Ej: Carlos" required />
						<div class="underline"></div>
					</div>

					<div class="form-group half-width">
						<label for="apellido">Apellido</label>
						<input
							id="apellido"
							type="text"
							bind:value={apellido}
							placeholder="Ej: Martínez"
							required
						/>
						<div class="underline"></div>
					</div>
				</div>

				<!-- Email y teléfono -->
				<div class="form-group">
					<label for="email">Correo electrónico</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						placeholder="Ej: usuario@mail.com"
						required
					/>
					<div class="underline"></div>
				</div>

				<div class="form-group">
					<label for="telefono">Teléfono</label>
					<input
						id="telefono"
						type="tel"
						bind:value={telefono}
						placeholder="Ej: +52 55 1234 5678"
						required
					/>
					<div class="underline"></div>
				</div>

				<!-- Contraseñas -->
				<div class="form-row">
					<div class="form-group half-width">
						<label for="password">Contraseña</label>
						<div class="password-input">
							<input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								placeholder="Mínimo 8 caracteres"
								minlength="8"
								required
							/>
							<button type="button" class="toggle-password" on:click={togglePassword}>
								{showPassword ? '🙈' : '👁️'}
							</button>
						</div>
						<div class="underline"></div>
					</div>

					<div class="form-group half-width">
						<label for="confirmPassword">Confirmar contraseña</label>
						<input
							id="confirmPassword"
							type={showPassword ? 'text' : 'password'}
							bind:value={confirmPassword}
							placeholder="Repite tu contraseña"
							required
						/>
						<div class="underline"></div>
					</div>
				</div>

				<!-- Datos adicionales -->
				<div class="form-row">
					<div class="form-group half-width">
						<label for="genero">Género</label>
						<select id="genero" bind:value={genero}>
							<option class="text-dark" value="" disabled selected>Seleccionar</option>
							{#each generos as genero}
								<option class="text-dark" value={genero.value}>{genero.label}</option>
							{/each}
						</select>
						<div class="underline"></div>
					</div>

					<div class="form-group half-width">
						<label for="fechaNacimiento">Fecha de nacimiento</label>
						<input id="fechaNacimiento" type="date" bind:value={fechaNacimiento} />
						<div class="underline"></div>
					</div>
				</div>

				<!-- Términos y condiciones -->
				<div class="form-check">
					<input id="terminos-registro" type="checkbox" bind:checked={aceptaTerminos} required />
					<label for="terminos-registro">
						Acepto los <a href="#1" class="terms-link">Términos</a> y
						<a href="#2" class="terms-link">Política de privacidad</a>
					</label>
				</div>

				<!-- Botón de registro -->
				<button type="submit" class="btn-submit" disabled={!aceptaTerminos}>
					<span class="btn-icon">👤</span>
					<span>Crear cuenta</span>
				</button>

				<!-- Enlace a login -->
				<div class="login-link">
					¿Ya tienes cuenta? <a href="/auth">Inicia sesión</a>
				</div>
			</form>

			{#if errorMessage}
  <div class="error-message">
    {errorMessage}
  </div>
{/if}

			<!-- Elementos decorativos -->
			<div class="floating-elements">
				<div class="circle circle-1"></div>
				<div class="circle circle-2"></div>
			</div>
		</div>
	</div>
</div>

<style>
	/* === ESTILOS GLOBALES === */
	:global(body) {
		font-family: 'Poppins', sans-serif;
		background: linear-gradient(135deg, #f3f4f6, #0f0f0f);
		height: 100vh;
		margin: 0;
		padding: 0;
		overflow-x: hidden;
	}

	/* === ESTRUCTURA PRINCIPAL === */
	.wrapper {
		height: 100vh;
		overflow-y: auto;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 20px 0;
	}

	.error-message {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
  border-left: 3px solid #ff6b6b;
}

	.scroll-container {
		width: 100%;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.container {
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.18);
		width: 85%;
		max-width: 600px;
		margin: 2rem auto;
		padding: 2.5rem;
		border-radius: 20px;
		box-shadow:
			0 8px 32px rgba(31, 38, 135, 0.15),
			0 4px 16px rgba(0, 0, 0, 0.1);
		animation: fallDown 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
		opacity: 0;
		transform: translateY(-30px);
		position: relative;
		z-index: 10;
	}

	/* === ANIMACIONES === */
	@keyframes fallDown {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		50% {
			transform: translateY(-15px) rotate(5deg);
		}
	}

	/* === TIPOGRAFÍA === */
	.title {
		font-size: 2.2rem;
		font-weight: 700;
		color: #fff;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		margin-bottom: 1rem;
		text-align: center;
		position: relative;
		padding-bottom: 10px;
	}

	.title::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 60px;
		height: 3px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
		border-radius: 3px;
	}

	.subtitle {
		font-size: 1.1rem;
		color: rgba(255, 255, 255, 0.85);
		font-weight: 300;
		text-align: center;
		margin-bottom: 2rem;
	}

	/* === FORMULARIO === */
	.register-form {
		max-width: 500px;
		margin: 0 auto;
	}

	.form-row {
		display: flex;
		gap: 15px;
		margin-bottom: 1.2rem;
	}

	.form-group {
		position: relative;
		margin-bottom: 1.8rem;
		flex: 1;
	}

	label {
		display: block;
		margin-bottom: 0.6rem;
		color: rgba(255, 255, 255, 0.85);
		font-size: 0.95rem;
		font-weight: 400;
	}

	input,
	select {
		width: 100%;
		padding: 12px 0;
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		font-size: 1rem;
		outline: none;
		transition: all 0.3s ease;
	}

	.underline {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 0;
		height: 2px;
		background: white;
		transition: width 0.4s ease;
	}

	input:focus ~ .underline,
	select:focus ~ .underline {
		width: 100%;
	}

	/* === PASSWORD INPUT === */
	.password-input {
		position: relative;
	}

	.toggle-password {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 1.1rem;
		padding: 5px 8px;
		color: rgba(255, 255, 255, 0.7);
		transition: all 0.3s;
	}

	.toggle-password:hover {
		color: white;
		transform: translateY(-50%) scale(1.1);
	}

	/* === CHECKBOX Y RADIOS === */
	.form-check {
		margin: 2.5rem 0;
		display: flex;
		align-items: center;
	}

	.form-check input {
		width: auto;
		margin-right: 12px;
		accent-color: rgba(255, 255, 255, 0.7);
	}

	.form-check label {
		margin-bottom: 0;
		font-size: 0.9rem;
	}

	.terms-link {
		color: rgba(255, 255, 255, 0.8);
		text-decoration: underline;
		transition: color 0.3s;
	}

	.terms-link:hover {
		color: white;
		text-decoration: none;
	}

	/* === BOTÓN === */
	.btn-submit {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.15),
			rgba(255, 255, 255, 0.1)
		) !important;
		color: white !important;
		border: none;
		padding: 14px 28px;
		border-radius: 50px !important;
		font-weight: 600 !important;
		letter-spacing: 0.5px;
		transition: all 0.4s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin: 0 auto;
		cursor: pointer;
		width: 100%;
		backdrop-filter: blur(5px);
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
	}

	.btn-submit:hover {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.25),
			rgba(255, 255, 255, 0.15)
		) !important;
		transform: translateY(-3px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
	}

	.btn-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none !important;
		background: rgba(255, 255, 255, 0.1) !important;
	}

	.btn-icon {
		font-size: 1.2rem;
	}

	/* === ENLACE LOGIN === */
	.login-link {
		text-align: center;
		margin-top: 1.8rem;
		color: rgba(255, 255, 255, 0.65);
		font-size: 0.95rem;
	}

	.login-link a {
		color: white;
		text-decoration: none;
		font-weight: 500;
		margin-left: 5px;
		transition: all 0.3s;
	}

	.login-link a:hover {
		text-decoration: underline;
	}

	/* === ELEMENTOS DECORATIVOS === */
	.floating-elements {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		z-index: -1;
		pointer-events: none;
	}

	.circle {
		position: absolute;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		animation: float 12s infinite ease-in-out;
		filter: blur(1px);
	}

	.circle-1 {
		width: 120px;
		height: 120px;
		top: 15%;
		left: 10%;
		animation-delay: 0s;
	}

	.circle-2 {
		width: 180px;
		height: 180px;
		top: 65%;
		left: 75%;
		animation-delay: 2s;
		animation-duration: 15s;
	}

	/* === RESPONSIVE === */
	@media (max-width: 768px) {
		.container {
			width: 90%;
			padding: 1.8rem !important;
		}

		.title {
			font-size: 1.8rem;
		}

		.form-row {
			flex-direction: column;
			gap: 0;
		}

		.half-width {
			width: 100%;
		}
	}

	@media (max-width: 480px) {
		.container {
			padding: 1.5rem !important;
		}

		.title {
			font-size: 1.6rem;
		}

		.btn-submit {
			padding: 12px 20px;
		}
	}
</style>
