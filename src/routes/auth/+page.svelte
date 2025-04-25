<script lang="ts">
    import { supabase } from '../../components/supabase';
    import { goto } from '$app/navigation';
	
	

    let email = '';
    let password = '';
    let userType: 'conductor' | 'pasajero' = 'conductor';
    let rememberMe = false;
    let isLoading = false;
    let errorMessage = '';

    // Función reutilizable para validar email
    const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // Función para manejar almacenamiento
    const setAuthToken = (session: any, userType: string) => {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('supabase.auth.token', JSON.stringify(session));
        storage.setItem('userType', userType);
    };

    const handleLogin = async () => {
        isLoading = true;
        errorMessage = '';

        // Validación mejorada
        if (!email || !password) {
            errorMessage = 'Por favor, completa todos los campos';
            isLoading = false;
            return;
        }

        if (!isValidEmail(email)) {
            errorMessage = 'Por favor ingresa un email válido';
            isLoading = false;
            return;
        }

        try {
            console.time('Login process'); // Medir tiempos de ejecución

            // 1. Autenticación con Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password: password
            });

            console.log('Respuesta de Supabase:', data, error);
            if (error) throw error;
            if (!data || !data.user) throw new Error('No se pudo autenticar. Usuario no encontrado.');

            // 2. Verificar el tipo de usuario en la base de datos
            const { data: userData, error: dbError } = await supabase
                .from(userType)
                .select('*')
                .eq('email', email)
                .single();

            if (dbError || !userData) {
                throw new Error(`No se encontró un ${userType} con ese email`);
            }

            // 3. Opción "Recordarme"
            setAuthToken(data.session, userType);

            // 4. Redirigir al dashboard correspondiente con depuración
            console.log('Redirigiendo a:', `auth/dashboard-${userType}`);
            goto(`auth/dashboard-${userType}`);

            console.timeEnd('Login process'); // Fin de medición de tiempos
        } catch (error: unknown) {
            console.error('Error en login:', error);

            const errorMessages: Record<string, string> = {
                'Invalid login credentials': 'Credenciales incorrectas. Verifica tu email y contraseña.',
                'Email not confirmed': 'Por favor verifica tu email antes de iniciar sesión',
            };

            errorMessage = error instanceof Error
                ? errorMessages[error.message] || error.message
                : 'Ocurrió un error inesperado. Intenta nuevamente.';
        } finally {
            isLoading = false;
        }
    };
</script>


<div class="wrapper">
  <div class="scroll-container">
    <div class="container animate-fall">
      <div class="login-container">
        <h1 class="title">Acceso a Rapiditos Colón</h1>
        <p class="subtitle">Ingresa con tus credenciales</p>

        {#if errorMessage}
          <div class="error-message">
            ⚠️ {errorMessage}
            {#if errorMessage.includes('¿Quieres iniciar como')}
              <button
                on:click={() => {
                  userType = userType === 'pasajero' ? 'conductor' : 'pasajero';
                  errorMessage = '';
                }}
                class="switch-user-type"
              >
                Cambiar a {userType === 'pasajero' ? 'conductor' : 'pasajero'}
              </button>
            {/if}
          </div>
        {/if}

        <form on:submit|preventDefault={handleLogin} class="login-form">
          <!-- Selector de tipo de usuario -->
          <div class="user-type-selector">

            <label class:active={userType === 'conductor'}>
              <input type="radio" name="userType" bind:group={userType} value="conductor" />
              <span class="user-type-label">🚗 Conductor</span>
            </label>
          </div>

          <!-- Campos de formulario -->
          <div class="form-group">
            <input type="email" bind:value={email} placeholder="Correo electrónico" required autocomplete="username" />
            <div class="underline"></div>
          </div>

          <div class="form-group">
            <input
              type="password"
              bind:value={password}
              placeholder="Contraseña"
              minlength="6"
              required
			  autocomplete="current-password"
            />
            <div class="underline"></div>
          </div>


          <button type="submit" class="btn-submit" disabled={isLoading}>
            {#if isLoading}
              <span class="spinner"></span>
              Procesando...
            {:else}
              <span class="btn-icon">{userType === 'conductor' ? '🚗' : '👤'}</span>
              <span>Ingresar como {userType}</span>
            {/if}
          </button>
        </form>

        <div class="register-link">
         
          <a href="/conductor">Regístrate como conductor </a>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
	

	.wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: 20px;
	}

	.scroll-container {
		width: 100%;
		max-width: 1200px;
	}

	.container {
		background: rgba(255, 255, 255, 0.9);
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		padding: 40px;
		width: 100%;
		max-width: 500px;
		margin: 0 auto;
		animation: fallDown 0.5s ease-out forwards;
	}

	@keyframes fallDown {
		from {
			transform: translateY(-50px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	/* Estilos del formulario */
	.login-container {
		text-align: center;
	}

	.title {
		color: #2c3e50;
		font-size: 2.2rem;
		margin-bottom: 10px;
		font-weight: 700;
	}

	.subtitle {
		color: #7f8c8d;
		margin-bottom: 30px;
		font-size: 1rem;
	}

	/* Selector de tipo de usuario */
	.user-type-selector {
		display: flex;
		gap: 10px;
		margin-bottom: 25px;
		justify-content: center;
	}

	.user-type-selector label {
		flex: 1;
		padding: 12px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s;
		background: rgba(236, 240, 241, 0.7);
		border: 1px solid #dfe6e9;
	}

	.user-type-selector label.active {
		background: #3498db;
		border-color: #3498db;
		color: white;
	}

	.user-type-selector label.active .user-type-label {
		color: white;
	}

	.user-type-selector input {
		display: none;
	}

	.user-type-label {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-weight: 500;
		color: #2c3e50;
		font-size: 0.95rem;
	}

	/* Campos del formulario */
	.form-group {
		margin-bottom: 25px;
		position: relative;
	}

	.form-group input {
		width: 100%;
		padding: 12px 0;
		border: none;
		border-bottom: 2px solid #bdc3c7;
		background: transparent;
		font-size: 1rem;
		transition: all 0.3s;
	}

	.form-group input:focus {
		outline: none;
		border-bottom-color: #3498db;
	}

	.form-group input::placeholder {
		color: #95a5a6;
	}

	.underline {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 0;
		height: 2px;
		background: #3498db;
		transition: width 0.4s;
	}

	.form-group input:focus ~ .underline {
		width: 100%;
	}

	

	/* Mensaje de error */
	.error-message {
		background: rgba(231, 76, 60, 0.1);
		color: #e74c3c;
		padding: 12px 15px;
		border-radius: 8px;
		margin-bottom: 20px;
		border-left: 3px solid #e74c3c;
		text-align: left;
		font-size: 0.9rem;
	}

	.switch-user-type {
		background: none;
		border: none;
		color: #3498db;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		margin-left: 5px;
		font-size: inherit;
	}

	/* Botón de submit */
	.btn-submit {
		background: #3498db;
		color: white;
		border: none;
		padding: 14px 24px;
		border-radius: 50px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
	}

	.btn-submit:hover:not(:disabled) {
		background: #2980b9;
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
	}

	.btn-submit:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
		box-shadow: none;
	}

	.btn-icon {
		font-size: 1.2rem;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top-color: white;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Enlace de registro */
	.register-link {
		margin-top: 25px;
		color: #7f8c8d;
		font-size: 0.95rem;
	}

	.register-link a {
		color: #3498db;
		text-decoration: none;
		font-weight: 500;
	}

	.register-link a:hover {
		text-decoration: underline;
	}

	/* Responsive */
	@media (max-width: 600px) {
		.container {
			padding: 30px;
		}

		.title {
			font-size: 1.8rem;
		}

		.user-type-selector {
			flex-direction: column;
		}
	}
</style>
