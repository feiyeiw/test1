// ============================================
// ASRS Website New Features
// ============================================

// ASRS Cost Calculator
function calculateASRSCost() {
    const size = document.getElementById('warehouseSize');
    const locations = document.getElementById('storageLocations');
    const sku = document.getElementById('skuCount');
    const frequency = document.getElementById('frequency');
    
    if (!size || !locations || !sku || !frequency) {
        console.log('Cost calculator inputs not found');
        return null;
    }
    
    // Get values
    const sizeValue = size.value;
    const locationsValue = parseInt(locations.value) || 0;
    const skuValue = parseInt(sku.value) || 0;
    const frequencyValue = parseInt(frequency.value) || 0;
    
    // Parse warehouse size (L x W x H)
    let volume = 1000; // default
    if (sizeValue) {
        const dimensions = sizeValue.match(/(\d+)/g);
        if (dimensions && dimensions.length >= 3) {
            volume = dimensions[0] * dimensions[1] * dimensions[2];
        }
    }
    
    // Calculate base cost
    let baseCost = 50000; // Base infrastructure cost
    baseCost += locationsValue * 150; // Per location cost
    baseCost += skuValue * 10; // SKU management cost
    baseCost += volume * 0.5; // Volume-based cost
    
    // Throughput multiplier
    if (frequencyValue > 300) {
        baseCost *= 1.5; // Very high throughput
    } else if (frequencyValue > 150) {
        baseCost *= 1.3; // High throughput
    } else if (frequencyValue > 50) {
        baseCost *= 1.1; // Medium throughput
    }
    
    return Math.round(baseCost);
}

// Update cost estimate display
function updateCostEstimate() {
    const cost = calculateASRSCost();
    if (cost !== null) {
        const display = document.getElementById('costEstimateDisplay');
        if (display) {
            display.textContent = `Estimated Cost: $${cost.toLocaleString()}`;
        }
    }
}

// Initialize cost calculator
function initCostCalculator() {
    const inputs = ['warehouseSize', 'storageLocations', 'skuCount', 'frequency'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateCostEstimate);
        }
    });
}

// ASRS Cost Estimate Form Handler
function initCostEstimateForm() {
    const form = document.getElementById('costEstimateForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Collect form data
        const formData = {
            company: form.company?.value || '',
            location: form.location?.value || '',
            contactName: form.contactName?.value || '',
            phone: form.contactPhone?.value || '',
            warehouseSize: form.warehouseSize?.value || '',
            storageLocations: form.storageLocations?.value || '',
            unitWeight: form.unitWeight?.value || '',
            sku: form.skuCount?.value || form.sku?.value || '',
            frequency: form.frequency?.value || '',
            timeline: form.timeline?.value || '',
            additionalInfo: form.additionalInfo?.value || ''
        };
        
        // Calculate estimated cost
        const estimatedCost = calculateASRSCost();
        if (estimatedCost) {
            formData.estimatedCost = estimatedCost;
        }
        
        // Store in localStorage
        let inquiries = JSON.parse(localStorage.getItem('asrsInquiries') || '[]');
        inquiries.push({
            ...formData,
            submittedAt: new Date().toISOString(),
            id: 'inq_' + Date.now()
        });
        localStorage.setItem('asrsInquiries', JSON.stringify(inquiries));
        
        // Show success message
        alert('Thank you for your inquiry! We will review your requirements and provide a detailed cost estimate within 24 hours.');
        
        // Reset form
        form.reset();
        
        // Update cost display
        updateCostEstimate();
    });
}

// Case Studies Filter
function filterCases(type) {
    const cases = document.querySelectorAll('.case-summary-card, .case-card');
    cases.forEach(caseItem => {
        if (type === 'all' || caseItem.dataset.type === type) {
            caseItem.style.display = 'grid';
        } else {
            caseItem.style.display = 'none';
        }
    });
}

// Initialize filter buttons
function initCaseFilters() {
    const filterButtons = document.querySelectorAll('.case-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Filter cases
            const filterType = btn.dataset.filter || 'all';
            filterCases(filterType);
        });
    });
}

// Initialize ASRS features when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initCostCalculator();
    initCostEstimateForm();
    initCaseFilters();
});
