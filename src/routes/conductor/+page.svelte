<script lang="ts">
	import { supabase } from '../../components/supabase';
	import { goto } from '$app/navigation';
	
	type ConductorData = {
	  id?: string;
	  nombre: string;
	  placa: string;
	  licencia: string;
	  propiedad: string;
	  control: string;
	  marca: string;
	  email: string;
	  telefono: string;
	  acepta_terminos: boolean;
	  created_at?: string;
	};
  
	let nombre = '';
	let password = '';
	let placa = '';
	let licencia = '';
	let propiedad = '';
	let control = '';
	let email = '';
	let telefono = '';
	let marca = '';
	let aceptaTerminos = false;
	let showPassword = false;
	let errorMessage = '';
	let isLoading = false;
	
	function togglePassword() {
	  showPassword = !showPassword;
	}
	
	async function handleSubmit() {
	  if (!aceptaTerminos) {
		errorMessage = 'Debes aceptar los términos y condiciones';
		return;
	  }
  
	  if (password.length < 8) {
		errorMessage = 'La contraseña debe tener al menos 8 caracteres';
		return;
	  }
  
	  isLoading = true;
	  errorMessage = '';
	  
	  try {
		const { data: authData, error: authError } = await supabase.auth.signUp({
		  email: email,
		  password: password,
		  options: {
			data: {
			  name: nombre,
			  role: 'conductor'
			}
		  }
		});
  
		if (authError) throw authError;
		if (!authData.user) throw new Error('No se pudo crear el usuario');
  
		const conductorData: ConductorData = {
		  nombre: nombre.trim(),
		  placa: placa.trim().toUpperCase(),
		  licencia: licencia.trim(),
		  propiedad: propiedad,
		  control: control.toString().trim(), // Convertimos a string antes de trim
		  marca: marca.trim(),
		  email: email.toLowerCase().trim(),
		  telefono: telefono.toString().trim(), // Convertimos a string antes de trim
		  acepta_terminos: aceptaTerminos,
		  created_at: new Date().toISOString()
		};
  
		const { error: dbError } = await supabase
		  .from('conductor')
		  .insert(conductorData);
  
		if (dbError) throw dbError;
  
		goto('/auth');
  
	  } catch (error: unknown) {
		if (error instanceof Error) {
		  errorMessage = error.message;
		  
		  if (error.message.includes('User already registered')) {
			errorMessage = 'Este email ya está registrado';
		  } else if (error.message.includes('password')) {
			errorMessage = 'La contraseña no cumple los requisitos';
		  }
		} else {
		  errorMessage = 'Ocurrió un error inesperado';
		}
		
		console.error('Error en registro:', error);
	  } finally {
		isLoading = false;
	  }
	}
</script>
  
  <div class="wrapper">
	<div class="scroll-container">
	  <div class="container animate-fall">
		<div class="container text-center p-5 rounded">
		  <h1 class="title">Registro de Conductores</h1>
		  <p class="subtitle">Completa tus datos para comenzar</p>
  
		  {#if errorMessage}
			<div class="alert alert-danger mb-4">
			  {errorMessage}
			</div>
		  {/if}
  
		  <form on:submit|preventDefault={handleSubmit} class="driver-form">
			<!-- Campos del formulario -->
			<div class="form-group">
			  <label for="nombre">Nombre completo</label>
			  <input
				id="nombre"
				type="text"
				bind:value={nombre}
				placeholder="Ej: Juan Pérez"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="control">Número de control</label>
			  <input
				id="control"
				type="number"
				bind:value={control}
				placeholder="Ej: 12345"
				required
			  />
			  <div class="underline"></div>
			</div>

			<div class="form-group">
			  <label for="control">Telefono</label>
			  <input
				id="telefono"
				type="number"
				bind:value={telefono}
				placeholder="Ej: 12345"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="marca">Marca y modelo</label>
			  <input
				id="marca"
				type="text"
				bind:value={marca}
				placeholder="Ej: Toyota Corolla 2020"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="propiedad">Tipo de conductor</label>
			  <select id="propiedad" class="text-dark" bind:value={propiedad} required>
				<option value="" disabled selected>Selecciona</option>
				<option value="socio">Socio</option>
				<option value="avance">Avance</option>
			  </select>
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="placa">Placa del vehículo</label>
			  <input id="placa" type="text" bind:value={placa} placeholder="Ej: ABC-123" required />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="licencia">Número de licencia</label>
			  <input
				id="licencia"
				type="text"
				bind:value={licencia}
				placeholder="Ej: 123456789"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="email">Correo electrónico</label>
			  <input
				id="email"
				type="email"
				bind:value={email}
				placeholder="Ej: ejemplo@gmail.com"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
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
  
			<div class="form-check">
			  <input id="terminos" type="checkbox" bind:checked={aceptaTerminos} required />
			  <label for="terminos">Acepto los términos y condiciones</label>
			</div>
  
			<button type="submit" class="btn-submit" disabled={!aceptaTerminos || isLoading}>
			  {#if isLoading}
				<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
				Procesando...
			  {:else}
				<span class="btn-icon">🚗</span>
				<span>Registrarme como conductor</span>
			  {/if}
			</button>
		  </form>
  
		  <!-- Elementos decorativos -->
		  <div class="floating-elements">
			<div class="circle circle-1"></div>
			<div class="circle circle-2"></div>
			<div class="circle circle-3"></div>
		  </div>
		</div>
	  </div>
	</div>
  </div>

<style>
	/* === ESTILOS GLOBALES (igual que tu pantalla de inicio) === */
	:global(body) {
		font-family: 'Poppins', sans-serif;
		background: linear-gradient(135deg, #f3f4f6, #0f0f0f);
		height: 100vh;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	.wrapper {
		height: 100vh;
		overflow-y: auto; /* Permite scroll si el contenido es largo */
	}

	.scroll-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 20px 0; /* Espacio para el scroll */
	}

	.container {
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		width: 80%;
		max-width: 600px;
		margin: 2rem auto; /* Margen superior para la animación */
		padding: 2.5rem;
		border-radius: 20px;
		box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
		animation: fallDown 1s ease-out forwards;
		opacity: 0; /* Inicia invisible */
	}

	.container:hover {
		transform: translateY(-50%) scale(1.02);
		box-shadow:
			0 20px 40px rgba(0, 0, 0, 0.3),
			0 10px 20px rgba(0, 0, 0, 0.2) !important;
	}

	.title {
		font-size: 2.5rem;
		font-weight: 700;
		color: #fff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		margin-bottom: 1.5rem;
		position: relative;
		display: inline-block;
		animation: textGlow 2s infinite alternate;
	}

	.title::after {
		content: '';
		position: absolute;
		bottom: -10px;
		left: 50%;
		transform: translateX(-50%);
		width: 50px;
		height: 3px;
		background: #fff;
		border-radius: 3px;
	}

	.subtitle {
		font-size: 1.2rem;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 2rem;
		font-weight: 300;
	}

	/* === ESTILOS DEL FORMULARIO (los que ya tenías) === */
	.driver-form {
		max-width: 500px;
		margin: 0 auto;
		text-align: left;
	}

	.form-group {
		margin-bottom: 1.5rem;
		position: relative;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		color: rgba(255, 255, 255, 0.9);
		font-weight: 300;
	}

	input,
	select {
		width: 100%;
		padding: 10px 0;
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		font-size: 1rem;
		outline: none;
		transition: all 0.3s ease;
	}

	input:focus,
	select:focus {
		border-bottom-color: white;
	}

	.underline {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 0;
		height: 2px;
		background: white;
		transition: width 0.3s ease;
	}

	input:focus ~ .underline,
	select:focus ~ .underline {
		width: 100%;
	}

	.form-check {
		margin: 2rem 0;
		display: flex;
		align-items: center;
	}

	.form-check input {
		width: auto;
		margin-right: 10px;
	}

	.btn-submit {
		background: rgba(255, 255, 255, 0.1) !important;
		color: white !important;
		border: none;
		padding: 12px 25px;
		border-radius: 50px !important;
		font-weight: 600 !important;
		text-transform: uppercase;
		letter-spacing: 1px;
		transition: all 0.4s ease;
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 auto;
		cursor: pointer;
	}

	.btn-submit:hover {
		background: rgba(255, 255, 255, 0.2) !important;
		transform: translateY(-3px);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
	}

	.btn-submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	/* === ELEMENTOS FLOTANTES === */
	.floating-elements {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		z-index: -1;
	}

	.circle {
		position: absolute;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		animation: float 15s infinite linear;
	}

	.circle-1 {
		width: 100px;
		height: 100px;
		top: 10%;
		left: 10%;
	}

	.circle-2 {
		width: 150px;
		height: 150px;
		top: 60%;
		left: 70%;
		animation-delay: 2s;
	}

	.circle-3 {
		width: 70px;
		height: 70px;
		top: 80%;
		left: 20%;
		animation-delay: 4s;
	}

	.toggle-password {
		position: absolute;
		right: 0;
		top: 70%;
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

	/* === ANIMACIONES === */
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(50px) translateY(-50%);
		}
		to {
			opacity: 1;
			transform: translateY(0) translateY(-50%);
		}
	}

	@keyframes float {
		0% {
			transform: translateY(0) rotate(0deg);
		}
		50% {
			transform: translateY(-20px) rotate(180deg);
		}
		100% {
			transform: translateY(0) rotate(360deg);
		}
	}

	@keyframes textGlow {
		from {
			text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
		}
		to {
			text-shadow:
				0 0 15px rgba(255, 255, 255, 0.8),
				0 0 20px rgba(255, 255, 255, 0.6);
		}
	}

	@keyframes fallDown {
		from {
			opacity: 0;
			transform: translateY(-100px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.container {
			width: 90%;
			padding: 1.5rem !important;
		}

		.title {
			font-size: 2rem;
		}
	}
</style>
