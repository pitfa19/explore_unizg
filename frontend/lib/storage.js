export const STUDENT_ID_KEY = "student_id";

export function getStudentId() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STUDENT_ID_KEY);
		if (!raw) return null;
		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function setStudentId(id) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STUDENT_ID_KEY, String(id));
	} catch {
		// ignore storage errors
	}
}

export function clearStudentId() {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(STUDENT_ID_KEY);
	} catch {
		// ignore storage errors
	}
}


