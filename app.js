// API Configuration
const API_URL = 'https://roof-intelligence-6a30489ce677.herokuapp.com/';

// DOM Elements
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');
const resultsSection = document.getElementById('resultsSection');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// State
let selectedFiles = [];

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    // Check if API is available
    fetch(`${API_URL}/api-status`)
        .then(response => response.json())
        .then(data => {
            console.log('API Status:', data);
            if (!data.apiKeyConfigured || !data.apiKeyConfigured.startsWith('Yes')) {
                alert('Warning: The API server does not have a properly configured OpenAI API key.');
            }
        })
        .catch(error => {
            console.error('API Status Check Error:', error);
            alert('Could not connect to the API server. Please check if the server is running.');
        });
    
    // Set up event listeners
    setupDragAndDrop();
    setupTabNavigation();
    
    // Analyze button
    analyzeBtn.addEventListener('click', analyzeRoof);
}

function setupDragAndDrop() {
    // Clicking the drop area activates file input
    dropArea.addEventListener('click', () => fileInput.click());
    
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('active'));
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('active'));
    });
    
    dropArea.addEventListener('drop', handleDrop);
}

function setupTabNavigation() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const tabName = button.getAttribute('data-tab');
            document.getElementById(tabName).classList.add('active');
        });
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    // Add new files to the array (up to 15 total)
    const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    // Limit to max 15 files
    const availableSlots = 15 - selectedFiles.length;
    const filesToAdd = newFiles.slice(0, availableSlots);
    
    if (newFiles.length > availableSlots) {
        alert(`Only ${availableSlots} more images can be added (maximum 15 total).`);
    }
    
    if (filesToAdd.length > 0) {
        selectedFiles = [...selectedFiles, ...filesToAdd];
        updateImagePreview();
        updateAnalyzeButton();
    }
}

function updateImagePreview() {
    // Clear the preview
    imagePreview.innerHTML = '';
    
    // Add each image to the preview
    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeImage(index);
            });
            
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            imagePreview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

function removeImage(index) {
    selectedFiles.splice(index, 1);
    updateImagePreview();
    updateAnalyzeButton();
}

function updateAnalyzeButton() {
    analyzeBtn.disabled = selectedFiles.length === 0;
}

async function analyzeRoof() {
    if (selectedFiles.length === 0) {
        alert('Please select at least one image');
        return;
    }
    
    // Show loading overlay
    loadingOverlay.style.display = 'flex';
    loadingMessage.textContent = 'Processing images...';
    
    try {
        // Convert all files to base64
        const images = [];
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const base64 = await fileToBase64(file);
            images.push(base64.split(',')[1]); // Remove data URL prefix
            
            // Update progress message
            loadingMessage.textContent = `Processing image ${i + 1} of ${selectedFiles.length}...`;
        }
        
        loadingMessage.textContent = 'Sending images to AI for analysis...';
        
        // Call the API
        const response = await fetch(`${API_URL}/api/analyze-roof-multiple`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images })
        });
        
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Log the raw response
        console.log('Raw API Response:', data);
        
        // Process and display results
        displayResults(data);
        
        // Show results section
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Analysis Error:', error);
        alert(`Error during analysis: ${error.message}`);
    } finally {
        // Hide loading overlay
        loadingOverlay.style.display = 'none';
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function displayResults(data) {
    console.log('Raw API Response:', data);
    
    // Extract the JSON content from the response
    let resultJson;
    try {
        // First try to use parsedResults if available
        if (data.parsedResults) {
            resultJson = data.parsedResults;
        } 
        // Then try to access the content directly
        else if (data.choices && data.choices[0] && data.choices[0].message) {
            const content = data.choices[0].message.content;
            
            // Check if the content is a string and try to parse JSON from it
            if (typeof content === 'string') {
                // Look for JSON anywhere in the string
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    resultJson = JSON.parse(jsonMatch[0]);
                } else {
                    // If no JSON is found, create a basic object with the content
                    resultJson = { 
                        responseText: content,
                        error: "No JSON structure found in response"
                    };
                    
                    // Show the raw text in the JSON panel
                    document.getElementById('json').textContent = content;
                    return;
                }
            } else {
                resultJson = { error: "Response content is not a string" };
            }
        } else {
            // Just display whatever we got as-is
            resultJson = data;
        }
    } catch (error) {
        console.error('Error parsing results:', error);
        resultJson = { 
            error: "Failed to parse analysis results",
            errorDetails: error.message,
            rawResponse: JSON.stringify(data)
        };
        
        // Show the raw response in the JSON panel
        document.getElementById('json').textContent = JSON.stringify(data, null, 2);
        return;
    }
    
    // Display raw JSON
    document.getElementById('json').textContent = JSON.stringify(resultJson, null, 2);
    
    // Format and display each section
    if (resultJson) {
        displayMaterialsSection(resultJson.materialSpecification || {});
        displayDamageSection(resultJson.damageAssessment || {});
        displayMeasurementsSection(resultJson.advancedMeasurements || {});
        displayRepairsSection(resultJson.repairAssessment || {});
    }
}

function displayMaterialsSection(materials) {
    const container = document.getElementById('materials');
    container.innerHTML = '';
    
    if (Object.keys(materials).length === 0) {
        container.innerHTML = '<p>No material information available</p>';
        return;
    }
    
    const html = `
        <div class="result-card">
            <h3>Roof Material Information</h3>
            <div class="info-group">
                <p><strong>Material:</strong> ${materials.name || 'Unknown'}</p>
                <p><strong>Manufacturer:</strong> ${materials.manufacturer || 'Unknown'}</p>
                <p><strong>Type:</strong> ${materials.materialSubtype || 'Unknown'}</p>
                <p><strong>Estimated Age:</strong> ${materials.estimatedAge || 'Unknown'}</p>
                <p><strong>Expected Lifespan:</strong> ${materials.lifespan || 'Unknown'}</p>
                <p><strong>Colors:</strong> ${Array.isArray(materials.colors) ? materials.colors.join(', ') : 'Unknown'}</p>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function displayDamageSection(damage) {
    const container = document.getElementById('damage');
    container.innerHTML = '';
    
    if (Object.keys(damage).length === 0) {
        container.innerHTML = '<p>No damage information available</p>';
        return;
    }
    
    let damageTypesHtml = '';
    if (Array.isArray(damage.damageTypes) && damage.damageTypes.length > 0) {
        damageTypesHtml = `
            <div class="damage-types">
                <h4>Damage Types Detected:</h4>
                <ul>
                    ${damage.damageTypes.map(type => `<li>${type}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    const html = `
        <div class="result-card">
            <h3>Damage Assessment</h3>
            <div class="info-group">
                <p><strong>Overall Condition:</strong> <span class="condition-${damage.overallCondition?.toLowerCase() || 'unknown'}">${damage.overallCondition || 'Unknown'}</span></p>
                <p><strong>Damage Severity:</strong> ${damage.damageSeverity || 'N/A'}/10</p>
                ${damageTypesHtml}
                <div class="damage-description">
                    <h4>Description:</h4>
                    <p>${damage.description || 'No detailed description available.'}</p>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function displayMeasurementsSection(measurements) {
    const container = document.getElementById('measurements');
    container.innerHTML = '';
    
    if (Object.keys(measurements).length === 0) {
        container.innerHTML = '<p>No measurement information available</p>';
        return;
    }
    
    const roofArea = measurements.totalRoofArea || {};
    const roofDimensions = measurements.roofDimensions || {};
    const roofPitch = measurements.roofPitch || {};
    
    const html = `
        <div class="result-card">
            <h3>Roof Measurements</h3>
            <div class="info-group">
                <div class="measurement-item">
                    <h4>Total Roof Area:</h4>
                    <p class="measurement-value">${roofArea.value || 'Unknown'} sq ft</p>
                    <p class="confidence">Confidence: ${roofArea.confidenceScore || 'N/A'}/10</p>
                </div>
                
                <div class="measurement-item">
                    <h4>Dimensions:</h4>
                    <p>Length: ${roofDimensions.length || 'Unknown'} ft</p>
                    <p>Width: ${roofDimensions.width || 'Unknown'} ft</p>
                    <p>Height: ${roofDimensions.height || 'Unknown'} ft</p>
                </div>
                
                <div class="measurement-item">
                    <h4>Roof Pitch:</h4>
                    <p>Ratio: ${roofPitch.primary || 'Unknown'}</p>
                    <p>Angle: ${roofPitch.degrees || 'Unknown'}°</p>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function displayRepairsSection(repairs) {
    const container = document.getElementById('repairs');
    container.innerHTML = '';
    
    if (Object.keys(repairs).length === 0) {
        container.innerHTML = '<p>No repair information available</p>';
        return;
    }
    
    const html = `
        <div class="result-card">
            <h3>Repair Assessment</h3>
            <div class="info-group">
                <p><strong>Recommendation:</strong> <span class="recommendation-${repairs.repairRecommendation?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}">${repairs.repairRecommendation || 'Unknown'}</span></p>
                <p><strong>Urgency:</strong> <span class="urgency-${repairs.urgency?.toLowerCase() || 'unknown'}">${repairs.urgency || 'Unknown'}</span></p>
                <p><strong>Difficulty:</strong> ${repairs.repairDifficulty || 'Unknown'}</p>
                <p><strong>DIY Feasible:</strong> ${repairs.diyFeasibility ? 'Yes' : 'No'}</p>
                
                <div class="cost-estimate">
                    <h4>Cost Estimates:</h4>
                    <p><strong>Repair:</strong> ${repairs.anticipatedRepairCost || 'Unknown'}</p>
                    <p><strong>Replacement:</strong> ${repairs.anticipatedReplacementCost || 'Unknown'}</p>
                </div>
                
                ${Array.isArray(repairs.specialConsiderations) && repairs.specialConsiderations.length > 0 ?
                    `<div class="special-considerations">
                        <h4>Special Considerations:</h4>
                        <ul>
                            ${repairs.specialConsiderations.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>` : ''
                }
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}
