// VARIABLES GLOBALES
let jsonDatabase = [];
let jsonDevData = [];
let customDatabase = []; 
let database = []; 
let developmentData = []; 
let currentQuestions = [];
let isStudyMode = false;
let timerInterval;
let timeRemaining;
let adminOptionCount = 2;
let editingQuestionId = null;
let currentEditBase64 = null;

// INICIALIZACIÓN CON SERVIDOR (Netlify / GitHub Pages)
document.addEventListener("DOMContentLoaded", () => {
    fetch('preguntas.json')
        .then(response => {
            if (!response.ok) throw new Error("No se pudo cargar preguntas.json");
            return response.json();
        })
        .then(data => {
            if (data.multipleChoice) jsonDatabase = data.multipleChoice.map(q => ({...q, subject: q.subject || "Seguridad y Calidad"}));
            if (data.development) jsonDevData = data.development.map(q => ({...q, subject: q.subject || "Seguridad y Calidad"}));
            initApp();
        })
        .catch(error => {
            console.warn("No se encontró preguntas.json o hubo un error al leerlo. Se usará solo el LocalStorage.", error);
            initApp();
        });
});

function initApp() {
    customDatabase = JSON.parse(localStorage.getItem('customQuestions')) || [];
    updateActiveSubject(); 
    initAdminOptions(); 
}

function getAllQuestions() {
    let combined = [...jsonDatabase];
    customDatabase.forEach(customQ => {
        let existingIndex = combined.findIndex(q => q.id === customQ.id && q.subject === customQ.subject);
        if (existingIndex !== -1) {
            combined[existingIndex] = customQ;
        } else {
            combined.push(customQ);
        }
    });
    return combined;
}

// Función auxiliar de protección por si el elemento está oculto (comentado en HTML)
function getActiveSubject() {
    const select = document.getElementById('global-subject');
    return select ? select.value : "Taller Web 2";
}

function updateActiveSubject() {
    const activeSubject = getActiveSubject();
    database = getAllQuestions().filter(q => q.subject === activeSubject);
    developmentData = jsonDevData.filter(q => q.subject === activeSubject);
    
    const maxQElem = document.getElementById('max-q');
    const qtyElem = document.getElementById('cfg-qty');
    
    if (maxQElem) maxQElem.innerText = database.length;
    
    if (qtyElem) {
        if (database.length === 0) qtyElem.value = 0;
        else if (parseInt(qtyElem.value) > database.length || qtyElem.value == 0) qtyElem.value = database.length > 30 ? 30 : database.length;
    }
    
    updateRangeInfo();
}

function navTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    const backBtn = document.getElementById('header-back-btn');
    if (screenId === 'home-screen') {
        backBtn.style.display = 'none';
    } else {
        backBtn.style.display = 'flex'; 
    }

    if (screenId === 'setup-screen') updateRangeInfo();
    if (screenId === 'admin-screen') initAdminOptions();
}

function goHome() {
    const examScreen = document.getElementById('exam-screen');
    const btnFinish = document.getElementById('btn-finish');
    
    if (examScreen.classList.contains('active') && btnFinish.style.display !== 'none' && !isStudyMode) {
        if (!confirm("El examen está en curso. ¿Estás seguro de que deseas salir y perder tu progreso?")) return;
    }

    clearInterval(timerInterval);
    document.getElementById('timer-display').style.display = 'none';
    document.getElementById('development-questions-container').style.display = 'none';
    
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';

    navTo('home-screen');
}

// ==========================================
// MODAL DE IMÁGENES
// ==========================================
function openModal(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    modal.style.display = "block";
    modalImg.src = src;
}

function closeModal() {
    document.getElementById('image-modal').style.display = "none";
}

// ==========================================
// SISTEMA DE ADMINISTRACIÓN Y EDICIÓN
// ==========================================

function initAdminOptions() {
    loadAdminQuestionsList();
    resetAdminForm();
}

function updateAdminSubjectChange() {
    resetAdminForm();
    loadAdminQuestionsList();
}

function loadAdminQuestionsList() {
    const subjectSelect = document.getElementById('admin-subject');
    if(!subjectSelect) return; 
    
    const subject = subjectSelect.value;
    const select = document.getElementById('admin-edit-select');
    select.innerHTML = '<option value="">-- Crear Nueva Pregunta --</option>';
    
    const subjectQs = getAllQuestions().filter(q => q.subject === subject);
    subjectQs.forEach(q => {
        select.innerHTML += `<option value="${q.id}">ID: ${q.id} - ${q.question.substring(0, 50)}...</option>`;
    });
}

function onEditSelectChange() {
    const id = document.getElementById('admin-edit-select').value;
    if (!id) {
        resetAdminForm();
        return;
    }
    
    const subject = document.getElementById('admin-subject').value;
    const q = getAllQuestions().find(q => q.id == id && q.subject === subject);
    
    if(q) {
        editingQuestionId = q.id;
        document.getElementById('admin-question').value = q.question;
        document.getElementById('admin-image-url').value = '';
        document.getElementById('admin-image-file').value = '';
        
        if (q.image && q.image.startsWith('http')) {
            document.getElementById('admin-image-url').value = q.image;
            currentEditBase64 = null;
        } else if (q.image) {
            currentEditBase64 = q.image;
        } else {
            currentEditBase64 = null;
        }

        adminOptionCount = q.options.length;
        document.getElementById('admin-opt-count-display').innerText = adminOptionCount;
        renderAdminOptionsUI(q.options, q.correct);
        
        document.getElementById('btn-save-admin').innerText = "Actualizar Pregunta";
    }
}

function resetAdminForm() {
    editingQuestionId = null;
    currentEditBase64 = null;
    if(document.getElementById('admin-edit-select')) document.getElementById('admin-edit-select').value = "";
    if(document.getElementById('admin-question')) document.getElementById('admin-question').value = "";
    if(document.getElementById('admin-image-url')) document.getElementById('admin-image-url').value = "";
    if(document.getElementById('admin-image-file')) document.getElementById('admin-image-file').value = "";
    if(document.getElementById('btn-save-admin')) document.getElementById('btn-save-admin').innerText = "Guardar Pregunta";
    
    adminOptionCount = 2; 
    if(document.getElementById('admin-opt-count-display')) {
        document.getElementById('admin-opt-count-display').innerText = adminOptionCount;
    }
    renderAdminOptionsUI();
}

function changeAdminOptionCount(delta) {
    let newCount = adminOptionCount + delta;
    if (newCount < 2) return; 

    let currentValues = [];
    let checkedIndex = 0;
    const radios = document.querySelectorAll('input[name="admin-correct"]');
    
    for (let i = 0; i < adminOptionCount; i++) {
        let input = document.getElementById(`admin-opt-${i}`);
        currentValues.push(input ? input.value : '');
        if (radios[i] && radios[i].checked) checkedIndex = i;
    }

    adminOptionCount = newCount;
    document.getElementById('admin-opt-count-display').innerText = adminOptionCount;

    if (checkedIndex >= adminOptionCount) checkedIndex = 0;

    renderAdminOptionsUI(currentValues, checkedIndex);
}

function renderAdminOptionsUI(values = [], checkedIdx = 0) {
    const container = document.getElementById('admin-options-container');
    if(!container) return;
    
    let html = `<label style="display: block; color: var(--primary-hover); margin-bottom: 10px;">Escribe las opciones y selecciona cuál es la correcta:</label>`;
    
    for (let i = 0; i < adminOptionCount; i++) {
        let val = values[i] !== undefined ? values[i] : '';
        let isChecked = i === checkedIdx ? 'checked' : '';
        html += `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 5px;">
                <input type="radio" name="admin-correct" value="${i}" ${isChecked} style="transform: scale(1.3); cursor: pointer; accent-color: var(--primary-hover);">
                <input type="text" id="admin-opt-${i}" value="${val}" placeholder="Escribe la opción ${i + 1} aquí..." style="flex: 1; border: none; border-bottom: 1px solid var(--border-color); background: transparent; border-radius: 0; padding: 5px; color: white;">
            </div>
        `;
    }
    container.innerHTML = html;
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function saveAdminQuestion() {
    const subject = document.getElementById('admin-subject').value;
    const questionText = document.getElementById('admin-question').value.trim();
    
    const radioChecked = document.querySelector('input[name="admin-correct"]:checked');
    if (!radioChecked) return alert("Por favor, selecciona cuál de las opciones es la correcta.");
    const correctIdx = parseInt(radioChecked.value);

    if (!questionText) return alert("Por favor, escribe el enunciado de la pregunta.");

    let options = [];
    for (let i = 0; i < adminOptionCount; i++) {
        let optText = document.getElementById(`admin-opt-${i}`).value.trim();
        if (!optText) return alert(`Por favor, completa el texto de la opción ${i + 1}.`);
        options.push(optText);
    }

    let finalImage = null;
    const imgUrl = document.getElementById('admin-image-url').value.trim();
    const fileInput = document.getElementById('admin-image-file');
    
    if (fileInput.files.length > 0) {
        finalImage = await getBase64(fileInput.files[0]);
    } else if (imgUrl !== "") {
        finalImage = imgUrl;
    } else if (editingQuestionId && currentEditBase64) {
        finalImage = currentEditBase64;
    }

    let qId = editingQuestionId;
    if (!qId) {
        const subjectQs = getAllQuestions().filter(q => q.subject === subject);
        qId = subjectQs.length > 0 ? Math.max(...subjectQs.map(q => q.id || 0)) + 1 : 1;
    }

    const newQuestion = {
        id: qId,
        subject: subject,
        question: questionText,
        options: options,
        correct: correctIdx
    };
    if (finalImage) newQuestion.image = finalImage;

    let existingIdx = customDatabase.findIndex(q => q.id === qId && q.subject === subject);
    if(existingIdx !== -1) {
        customDatabase[existingIdx] = newQuestion;
    } else {
        customDatabase.push(newQuestion);
    }

    localStorage.setItem('customQuestions', JSON.stringify(customDatabase));

    alert(`¡Pregunta guardada exitosamente! Recuerda usar el botón de Exportar para descargar los cambios a tu archivo físico.`);
    
    initAdminOptions(); 
    updateActiveSubject();
}

// ==========================================
// EXPORTAR BASE DE DATOS COMO JSON
// ==========================================
function exportDatabase() {
    let allQ = getAllQuestions();
    
    const exportData = {
        multipleChoice: allQ.map(q => {
            let obj = {
                id: q.id,
                subject: q.subject,
                question: q.question,
                options: q.options,
                correct: q.correct
            };
            if (q.image) obj.image = q.image; 
            return obj;
        }),
        development: jsonDevData
    };

    // Convertimos directamente a un string JSON válido
    const dataStr = JSON.stringify(exportData, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = "preguntas.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function toggleRange() {
    const order = document.getElementById('cfg-order').value;
    document.getElementById('range-container').style.display = order === 'orden' ? 'block' : 'none';
    updateRangeInfo();
}

function updateRangeInfo() {
    const infoBox = document.getElementById('range-info');
    if (database.length === 0) {
        infoBox.innerHTML = "<span style='color: #ef4444;'>No hay preguntas disponibles para esta materia. Ve a Administrar Preguntas.</span>";
        return;
    }
    
    let qty = parseInt(document.getElementById('cfg-qty').value) || 1;
    let startId = parseInt(document.getElementById('cfg-start').value) || 1;

    if (startId < 1) startId = 1;
    
    let startIndex = database.findIndex(q => q.id >= startId);
    if (startIndex === -1) {
        startIndex = database.length - 1;
        startId = database[startIndex].id; 
    }

    let actualStartId = database[startIndex].id;
    let endIndex = startIndex + qty - 1;
    
    if (endIndex >= database.length) {
        endIndex = database.length - 1;
        let cantReal = endIndex - startIndex + 1;
        let actualEndId = database[endIndex].id;
        
        infoBox.style.color = "#ffb74d"; 
        infoBox.innerHTML = `⚠️ Iniciarás en la pregunta <strong>${actualStartId}</strong> y llegarás hasta el final (<strong>${actualEndId}</strong>).<br><small>Solo hay ${cantReal} preguntas disponibles desde ese punto.</small>`;
    } else {
        let actualEndId = database[endIndex].id;
        infoBox.style.color = "#4db6ac"; 
        infoBox.innerHTML = `📌 Rango a evaluar: N° <strong>${actualStartId}</strong> hasta N° <strong>${actualEndId}</strong> (${qty} preguntas).`;
    }
}

function startStudyMode() {
    if(database.length === 0) return alert("No hay preguntas para la materia seleccionada.");
    isStudyMode = true;
    currentQuestions = [...database]; 
    document.getElementById('exam-title').innerText = `Modo Estudio: ${getActiveSubject()}`;
    document.getElementById('btn-finish').style.display = 'none';
    document.getElementById('results-summary').style.display = 'none';
    renderQuestions();
    renderDevelopmentQuestions(); 
    navTo('exam-screen');
}

function startExam() {
    if(database.length === 0) return alert("No hay preguntas para la materia seleccionada.");
    isStudyMode = false;
    let qty = parseInt(document.getElementById('cfg-qty').value) || 10;
    let timeMinutes = parseInt(document.getElementById('cfg-time').value) || 30;
    let order = document.getElementById('cfg-order').value;
    let pool = [...database];

    if (order === 'orden') {
        let startId = parseInt(document.getElementById('cfg-start').value) || 1;
        let startIndex = pool.findIndex(q => q.id >= startId);
        if (startIndex === -1) startIndex = 0;
        currentQuestions = pool.slice(startIndex, startIndex + qty);
    } else {
        pool = pool.sort(() => Math.random() - 0.5);
        currentQuestions = pool.slice(0, qty);
    }

    document.getElementById('exam-title').innerText = `Evaluación: ${getActiveSubject()}`;
    document.getElementById('btn-finish').style.display = 'inline-block';
    document.getElementById('results-summary').style.display = 'none';
    document.getElementById('development-questions-container').style.display = 'none'; 
    renderQuestions();
    startTimer(timeMinutes * 60);
    navTo('exam-screen');
}

function renderQuestions() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    currentQuestions.forEach((q, index) => {
        let imgHtml = q.image ? `<img src="${q.image}" class="question-img" onclick="openModal('${q.image}')" alt="Pista visual de la pregunta" title="Haz clic para agrandar">` : '';

        let html = `
            <div class="question-block" id="qblock-${index}">
                <div class="question-title">${index + 1}) ${q.question} <small style="color:#888;">(ID: ${q.id})</small></div>
                ${imgHtml}
        `;

        q.options.forEach((opt, optIndex) => {
            let isChecked = isStudyMode && q.correct === optIndex ? 'checked' : '';
            let disabled = isStudyMode ? 'disabled' : '';
            let labelClass = isStudyMode && q.correct === optIndex ? 'correct-text' : '';

            html += `
                <label class="option ${labelClass}" id="lbl-${index}-${optIndex}">
                    <input type="radio" name="q-${index}" value="${optIndex}" ${isChecked} ${disabled}>
                    ${opt}
                </label>
            `;
        });

        html += `</div>`;
        container.innerHTML += html;
    });
}

function renderDevelopmentQuestions() {
    if(developmentData.length === 0) return;
    const container = document.getElementById('development-questions-container');
    const content = document.getElementById('dev-content');
    content.innerHTML = '';
    
    developmentData.forEach(q => {
        let imgHtml = q.image ? `<img src="${q.image}" class="question-img" onclick="openModal('${q.image}')">` : '';
        content.innerHTML += `
            <div class="question-block" style="background-color: rgba(255,255,255,0.05); padding: 15px; border-radius: 5px;">
                <div class="question-title" style="color: var(--primary-color);"><strong>${q.id}) ${q.question}</strong></div>
                ${imgHtml}
                <div style="margin-top: 10px; font-size: 0.95rem;">${q.answer}</div>
            </div>
        `;
    });
    container.style.display = 'block';
}

function calculateGrade(correctas, total) {
    let baseCorrectas = (correctas * 30) / total; 
    let scoreBase30 = Math.round(baseCorrectas); 
    if (scoreBase30 >= 0 && scoreBase30 <= 5) return 1;
    if (scoreBase30 >= 6 && scoreBase30 <= 10) return 2;
    if (scoreBase30 >= 11 && scoreBase30 <= 17) return 3;
    if (scoreBase30 === 18) return 4;
    if (scoreBase30 >= 19 && scoreBase30 <= 21) return 5;
    if (scoreBase30 === 22) return 6;
    if (scoreBase30 === 23) return 7;
    if (scoreBase30 >= 24 && scoreBase30 <= 27) return 8;
    if (scoreBase30 >= 28 && scoreBase30 <= 29) return 9;
    if (scoreBase30 === 30) return 10;
    return 1; 
}

function finishExam() {
    if(!confirm("¿Estás seguro de que deseas finalizar el examen?")) return;

    clearInterval(timerInterval);
    document.getElementById('timer-display').style.display = 'none';
    
    let score = 0;

    currentQuestions.forEach((q, index) => {
        const selectedRadios = document.querySelectorAll(`input[name="q-${index}"]:checked`);
        let selectedVal = selectedRadios.length > 0 ? parseInt(selectedRadios[0].value) : -1;

        document.querySelectorAll(`input[name="q-${index}"]`).forEach(r => r.disabled = true);

        if (selectedVal === q.correct) {
            score++;
            document.getElementById(`lbl-${index}-${selectedVal}`).classList.add('correct');
            document.getElementById(`lbl-${index}-${selectedVal}`).classList.add('correct-text');
        } else {
            if (selectedVal !== -1) {
                document.getElementById(`lbl-${index}-${selectedVal}`).classList.add('incorrect');
                document.getElementById(`lbl-${index}-${selectedVal}`).classList.add('incorrect-text');
            }
            document.getElementById(`lbl-${index}-${q.correct}`).classList.add('correct');
            document.getElementById(`lbl-${index}-${q.correct}`).classList.add('correct-text');
        }
    });

    let nota = calculateGrade(score, currentQuestions.length);

    const summary = document.getElementById('results-summary');
    summary.style.display = 'block';
    let colorNota = nota >= 4 ? 'var(--correct-color, #34d399)' : 'var(--incorrect-color, #f87171)';
    let estado = nota >= 4 ? 'APROBADO' : 'DESAPROBADO';
    
    summary.innerHTML = `
        <div style="font-size: 1.5rem; margin-bottom: 10px;">Respuestas correctas: <strong>${score} de ${currentQuestions.length}</strong></div>
        <div style="font-size: 2rem; color: ${colorNota};">Nota: ${nota} (${estado})</div>
    `;

    document.getElementById('btn-finish').style.display = 'none';
    window.scrollTo(0, 0); 
}

function startTimer(seconds) {
    timeRemaining = seconds;
    const display = document.getElementById('timer-display');
    display.style.display = 'block';
    updateTimerDisplay();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("¡Tiempo agotado! El examen se finalizará automáticamente.");
            finishExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    let m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    let s = (timeRemaining % 60).toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    display.innerText = `Tiempo restante: ${m}:${s}`;
    display.style.color = timeRemaining < 60 ? '#ff6b6b' : 'white';
}

function normalizeText(text) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!.,:;()\n]/g, " ").replace(/\s+/g, " ").trim();
}

function searchAnswer() {
    const input = document.getElementById('search-input').value;
    const resultsContainer = document.getElementById('search-results');

    if (!input.trim()) {
        resultsContainer.innerHTML = '';
        return;
    }

    const normalizedInput = normalizeText(input);

    const matches = database.filter(q => {
        const normQ = normalizeText(q.question);
        return normalizedInput.includes(normQ) || normQ.includes(normalizedInput);
    });

    const devMatches = developmentData.filter(q => {
        const normQ = normalizeText(q.question);
        return normalizedInput.includes(normQ) || normQ.includes(normalizedInput);
    });

    if (matches.length === 0 && devMatches.length === 0) {
        resultsContainer.innerHTML = `
            <div style="padding: 15px; border-radius: var(--radius-md); background-color: rgba(239, 68, 68, 0.1); border: 1px dashed var(--incorrect-border); color: #f87171;">
                ❌ No se encontraron coincidencias.
            </div>`;
        return;
    }

    let html = '';
    matches.forEach(q => {
        let imgHtml = q.image ? `<img src="${q.image}" class="question-img" onclick="openModal('${q.image}')" alt="Pista visual">` : '';
        html += `
            <div class="question-block" style="background-color: rgba(255,255,255,0.02); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--primary-color);">
                <div class="question-title" style="color: white;"><strong>Pregunta ${q.id}:</strong> ${q.question}</div>
                ${imgHtml}
                <div style="margin-top: 15px;">
        `;
        q.options.forEach((opt, idx) => {
            let isCorrect = idx === q.correct;
            html += `
                <div class="option ${isCorrect ? 'correct' : ''}" style="cursor: default; opacity: ${isCorrect ? '1' : '0.3'}; margin-bottom: 5px;">
                    <span class="${isCorrect ? 'correct-text' : ''}">${isCorrect ? '✅' : '❌'} ${opt}</span>
                </div>
            `;
        });
        html += `</div></div>`;
    });

    devMatches.forEach(q => {
        let imgHtml = q.image ? `<img src="${q.image}" class="question-img" onclick="openModal('${q.image}')">` : '';
        html += `
            <div class="question-block" style="background-color: rgba(255,255,255,0.02); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--primary-color);">
                <div class="question-title" style="color: white;"><strong>Desarrollo ${q.id}:</strong> ${q.question}</div>
                ${imgHtml}
                <div style="margin-top: 15px; font-size: 0.95rem; color: #34d399;"><strong>Respuesta Correcta:</strong><br>${q.answer}</div>
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
}