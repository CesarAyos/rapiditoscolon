<script lang="ts">
	import { supabase } from '../../components/supabase';
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let userType: 'conductor' | 'pasajero' = 'conductor';
	let rememberMe = false;
	let isLoading = false;
	let errorMessage = '';

	const handleLogin = async () => {
		isLoading = true;
		errorMessage = '';

		// Validación mejorada
		if (!email || !password) {
			errorMessage = 'Por favor, completa todos los campos';
			isLoading = false;
			return;
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errorMessage = 'Por favor ingresa un email válido';
			isLoading = false;
			return;
		}

		try {
			// 1. Autenticación con Supabase
			const { data, error } = await supabase.auth.signInWithPassword({
				email: email.trim().toLowerCase(),
				password: password
			});

			if (error) throw error;
			if (!data?.user) throw new Error('No se pudo autenticar');

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
			const storage = rememberMe ? localStorage : sessionStorage;
			storage.setItem('supabase.auth.token', JSON.stringify(data.session));
			storage.setItem('userType', userType);

			// 4. Redirigir al dashboard correspondiente
			goto(`auth/dashboard-${userType}`);
		} catch (error: unknown) {
			console.error('Error en login:', error);

			if (error instanceof Error) {
				if (error.message.includes('Invalid login credentials')) {
					errorMessage = 'Credenciales incorrectas. Verifica tu email y contraseña.';
				} else if (error.message.includes('Email not confirmed')) {
					errorMessage = 'Por favor verifica tu email antes de iniciar sesión';
				} else if (error.message.includes('No se encontró')) {
					errorMessage = `El email no está registrado como ${userType}. ¿Quieres iniciar como ${userType === 'pasajero' ? 'conductor' : 'pasajero'}?`;
				} else {
					errorMessage = error.message || 'Error al iniciar sesión';
				}
			} else {
				errorMessage = 'Ocurrió un error inesperado. Intenta nuevamente.';
			}
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
            <!-- <label class:active={userType === 'pasajero'}>
              <input type="radio" name="userType" bind:group={userType} value="pasajero" />
              <span class="user-type-label">👤 Pasajero</span>
            </label> -->

            <label class:active={userType === 'conductor'}>
              <input type="radio" name="userType" bind:group={userType} value="conductor" />
              <span class="user-type-label">🚗 Conductor</span>
            </label>
          </div>

          <!-- Campos de formulario -->
          <div class="form-group">
            <input type="email" bind:value={email} placeholder="Correo electrónico" required />
            <div class="underline"></div>
          </div>

          <div class="form-group">
            <input
              type="password"
              bind:value={password}
              placeholder="Contraseña"
              minlength="6"
              required
            />
            <div class="underline"></div>
          </div>

          <!-- <div class="form-options">
            <label class="remember-me">
              <input type="checkbox" bind:checked={rememberMe} />
              <span class="checkmark"></span>
              Recordar sesión
            </label>
            <a href="/auth/recuperar" class="forgot-password"> ¿Olvidaste tu contraseña? </a>
          </div> -->

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
          <!-- ¿No tienes cuenta?
          <a href="/{userType}">Regístrate como {userType}</a> -->
        </div>
      </div>
    </div>
  </div>
</div>

<style>
	/* Estilos generales */
	:global(body) {
		font-family: 'Poppins', sans-serif;
		margin: 0;
		padding: 0;
		background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
		min-height: 100vh;
	}

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

	/* Opciones adicionales */
	.form-options {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 25px 0;
		font-size: 0.9rem;
	}

	.remember-me {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #7f8c8d;
		cursor: pointer;
	}

	.checkmark {
		width: 18px;
		height: 18px;
		border: 2px solid #bdc3c7;
		border-radius: 4px;
		display: inline-block;
		position: relative;
		transition: all 0.3s;
	}

	.remember-me input:checked + .checkmark {
		background: #3498db;
		border-color: #3498db;
	}

	.checkmark:after {
		content: '✓';
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) scale(0);
		transition: transform 0.2s;
		color: white;
		font-size: 0.8rem;
	}

	.remember-me input:checked + .checkmark:after {
		transform: translate(-50%, -50%) scale(1);
	}

	.forgot-password {
		color: #3498db;
		text-decoration: none;
		transition: color 0.3s;
	}

	.forgot-password:hover {
		text-decoration: underline;
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
