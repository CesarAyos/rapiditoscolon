<body>
	<div class="wrapper">
		<div class="container main-card">
			<div class="">
				<img src="/favicon.png" alt="icono" class="img-fluid" style="width: 100px;" />
			</div>
			<h1 class="title">¡Bienvenido a <span>Rapiditos Colón</span>!</h1>
			<p class="subtitle">Tu solución de transporte rápido y confiable</p>

			<div class="btn-grid">
				<a href="/auth" class="action-btn driver-btn">
					<span class="btn-icon">🚗</span>
					<span>Recuerda conducir con precaucion</span>
					<div class="hover-effect"></div>
				</a>
			</div>

			<div class="decorations">
				<div class="circle circle-1"></div>
				<div class="circle circle-2"></div>
				<div class="circle circle-3"></div>
			</div>
		</div>
	</div>
</body>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

	:root {
		--primary-blue: #018efa;
		--primary-orange: #f4680a;
		--secondary-blue: #5ab0ff;
		--secondary-orange: #ff8c42;
		--white: #ffffff;
		--light-gray: rgba(255, 255, 255, 0.8);
		--dark-shadow: rgba(0, 0, 0, 0.2);
	}

	* {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	body {
		font-family: 'Poppins', sans-serif;
		background: linear-gradient(135deg, var(--primary-blue) 0%, var(--primary-orange) 100%);
		min-height: 100vh;
		overflow: auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		position: relative;
		padding: 20px;
	}



	.wrapper {
		width: 100%;
    height: 90vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.main-card {
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 24px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
		width: 100%;
		max-width: 500px;
		padding: 3rem 2rem;
		text-align: center;
		position: relative;
		overflow: hidden;
		z-index: 10;
		animation: fadeInUp 0.8s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
		margin: 0 auto;
	}

	.title {
		font-size: 2.2rem;
		font-weight: 700;
		color: var(--white);
		margin-bottom: 0.5rem;
		text-shadow: 0 2px 4px var(--dark-shadow);
	}

	.title span {
		background: linear-gradient(90deg, var(--white), var(--secondary-orange));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		display: inline-block;
		animation: gradientShift 3s ease infinite;
		background-size: 200% auto;
	}

	.subtitle {
		color: var(--light-gray);
		font-size: 1rem;
		font-weight: 400;
		margin-bottom: 2.5rem;
		letter-spacing: 0.5px;
	}

	.btn-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		width: 100%;
		max-width: 300px;
		margin: 0 auto;
	}

	.action-btn {
		position: relative;
		padding: 1rem 1.5rem;
		border-radius: 50px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 1px;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		overflow: hidden;
		border: none;
		cursor: pointer;
		transition: all 0.4s ease;
		text-decoration: none;
		z-index: 1;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
	}

	.driver-btn {
		background: linear-gradient(45deg, var(--primary-blue), var(--secondary-blue));
		color: white;
	}

	

	.hover-effect {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(45deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1));
		opacity: 0;
		transition: opacity 0.3s ease;
		z-index: -1;
	}

	.action-btn:hover .hover-effect {
		opacity: 1;
	}

	.action-btn:hover {
		transform: translateY(-3px);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
	}

	.action-btn:active {
		transform: translateY(1px);
	}

	.btn-icon {
		font-size: 1.2rem;
		transition: transform 0.3s ease;
	}

	.action-btn:hover .btn-icon {
		transform: scale(1.2);
	}

	.decorations {
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
		width: 150px;
		height: 150px;
		top: -50px;
		left: -50px;
		animation-delay: 0s;
	}

	.circle-2 {
		width: 200px;
		height: 200px;
		bottom: -80px;
		right: -80px;
		animation-delay: 3s;
	}

	.circle-3 {
		width: 100px;
		height: 100px;
		top: 50%;
		right: -30px;
		animation-delay: 6s;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
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

	@keyframes gradientShift {
		0% {
			background-position: 0% center;
		}
		50% {
			background-position: 100% center;
		}
		100% {
			background-position: 0% center;
		}
	}

	/* Responsive styles */
	@media (max-width: 768px) {
		body {
			padding: 15px;
			justify-content: flex-start;
			padding-top: 30px;
		}

	

		.main-card {
			padding: 2rem 1.5rem;
			margin-top: 0;
		}

		.title {
			font-size: 1.8rem;
		}

		.subtitle {
			font-size: 0.9rem;
			margin-bottom: 2rem;
		}

		.action-btn {
			padding: 0.9rem 1.3rem;
			font-size: 0.9rem;
		}
	}

	@media (max-width: 480px) {
		body {
			padding: 10px;
			padding-top: 20px;
		}

		

		.main-card {
			padding: 1.5rem 1.2rem;
			border-radius: 18px;
		}

		.title {
			font-size: 1.5rem;
		}

		.subtitle {
			font-size: 0.85rem;
			margin-bottom: 1.8rem;
		}

		.btn-grid {
			max-width: 100%;
		}

		.action-btn {
			padding: 0.8rem 1rem;
		}
	}
</style>
