function getBaseUrl() {
	// Prefer explicit env; fallback to localhost:8000
	const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
	if (fromEnv && typeof fromEnv === "string") return fromEnv.replace(/\/+$/, "");
	return "http://localhost:8000";
}

export async function processMessage({ text, studentId }) {
	const base = getBaseUrl();
	const url = `${base}/api/message/`;

	const body = { text: String(text ?? "").trim() };
	if (studentId != null) {
		body.student_id = studentId;
	}

	const resp = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	const isJson = resp.headers.get("content-type")?.includes("application/json");
	const data = isJson ? await resp.json() : null;

	if (!resp.ok) {
		const message = data?.error || `Request failed with status ${resp.status}`;
		const error = new Error(message);
		error.status = resp.status;
		error.payload = data;
		throw error;
	}

	return {
		answer: typeof data?.answer === "string" ? data.answer : "",
		studentId: data?.student_id ?? null,
	};
}


export async function embedStudentAndKnn({ studentId, name }) {
	const base = getBaseUrl();
	const url = `${base}/api/embed-student/`;
	const body = {};
	if (studentId != null) body.student_id = studentId;
	if (name != null) body.name = String(name).trim();

	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	const isJson = resp.headers.get("content-type")?.includes("application/json");
	const data = isJson ? await resp.json() : null;

	if (!resp.ok) {
		const message = data?.error || `Request failed with status ${resp.status}`;
		const error = new Error(message);
		error.status = resp.status;
		error.payload = data;
		throw error;
	}

	return {
		studentId: data?.student_id ?? null,
		name: data?.name ?? "",
		neighbors: Array.isArray(data?.neighbors) ? data.neighbors : [],
	};
}

export async function getFacultyDetails(name) {
	const base = getBaseUrl();
	const url = `${base}/api/faculties/get/?name=${encodeURIComponent(name)}`;
	const resp = await fetch(url, { headers: { Accept: "application/json" } });
	const isJson = resp.headers.get("content-type")?.includes("application/json");
	const data = isJson ? await resp.json() : null;
	if (!resp.ok) {
		const message = data?.error || `Request failed with status ${resp.status}`;
		const error = new Error(message);
		error.status = resp.status;
		error.payload = data;
		throw error;
	}
	return data;
}

export async function getOrganisationDetails(name) {
	const base = getBaseUrl();
	const url = `${base}/api/organisations/get/?name=${encodeURIComponent(name)}`;
	const resp = await fetch(url, { headers: { Accept: "application/json" } });
	const isJson = resp.headers.get("content-type")?.includes("application/json");
	const data = isJson ? await resp.json() : null;
	if (!resp.ok) {
	 const message = data?.error || `Request failed with status ${resp.status}`;
	 const error = new Error(message);
	 error.status = resp.status;
	 error.payload = data;
	 throw error;
	}
	return data;
}


