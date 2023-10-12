
let camera, scene, renderer, clock;
let uniforms;

function init() {
	const container = document.getElementById("shader");

	clock = new THREE.Clock();
	camera = new THREE.Camera();
	camera.position.z = 1;

	scene = new THREE.Scene();

	const geometry = new THREE.PlaneBufferGeometry(2, 2);

	uniforms = {
		u_time: { type: "f", value: 1.0 },
		u_resolution: { type: "v2", value: new THREE.Vector2() },
	};

	const material = new THREE.ShaderMaterial({
		uniforms,
		vertexShader: document.getElementById("vertex").textContent,
		fragmentShader: document.getElementById("fragment").textContent
	});

	const mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio(window.devicePixelRatio);

	container.appendChild(renderer.domElement);

	onWindowResize();
	window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
	renderer.setSize(window.innerWidth, window.innerHeight);
	uniforms.u_resolution.value.x = renderer.domElement.width;
	uniforms.u_resolution.value.y = renderer.domElement.height;
}

function render() {
	uniforms.u_time.value = clock.getElapsedTime();
	renderer.render(scene, camera);
}

function animate() {
	render();
	requestAnimationFrame(animate);
}

init();
animate();