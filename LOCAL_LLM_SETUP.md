# Local LLM Integration Setup Guide

## Overview
This system uses **local LLM models** to generate medical reports from autism screening assessments. No external APIs are used, ensuring complete data privacy and HIPAA compliance.

---

## Architecture

### System Components:
1. **Local LLM Service** (`utils/local-llm-service.js`)
   - Analyzes assessment data
   - Generates clinical summaries
   - Provides evidence-based recommendations

2. **Ollama Server** (Recommended)
   - Local LLM inference server
   - Supports multiple medical models
   - Runs entirely on your machine

3. **Rule-Based Fallback**
   - Expert system with clinical guidelines
   - Activates when LLM unavailable
   - No dependencies required

---

## Installation Options

### Option 1: Ollama (Recommended for Production)

#### Step 1: Install Ollama

**Windows:**
```powershell
# Download installer from https://ollama.ai
# Or use winget:
winget install Ollama.Ollama
```

**macOS:**
```bash
# Using Homebrew
brew install ollama

# Or download from https://ollama.ai
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Step 2: Download Medical AI Models

```bash
# Basic model (faster, 7B parameters)
ollama pull llama2

# Better model (slower, more accurate, 13B parameters)
ollama pull llama2:13b

# Medical-specific model (best for healthcare)
ollama pull meditron

# Alternative: Mistral (good balance)
ollama pull mistral
```

#### Step 3: Start Ollama Service

```bash
# Start Ollama server (runs on port 11434)
ollama serve
```

#### Step 4: Test Installation

```bash
# Test if Ollama is working
curl http://localhost:11434/api/tags

# Test model inference
ollama run llama2 "What is autism spectrum disorder?"
```

#### Step 5: Configure Backend

Already configured in `.env`:
```properties
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

---

### Option 2: Rule-Based System (No Installation)

The system automatically uses a sophisticated rule-based expert system when Ollama is unavailable.

**Features:**
- Clinical guidelines-based analysis
- Evidence-based recommendations
- Risk stratification
- No setup required

**Limitations:**
- Less detailed than LLM
- No natural language variation
- Fixed response patterns

---

## Usage

### 1. Generate Report from Assessment

```javascript
// POST /api/reports/generate-from-assessment
{
  "assessmentId": "assessment_id_here",
  "childId": "child_id_here",
  "additionalNotes": "Optional doctor's notes"
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "_id": "report_id",
    "doctorId": "doctor_id",
    "childId": "child_id",
    "text": "Full formatted report text...",
    "analysis": {
      "summary": "Clinical summary...",
      "keyFindings": ["Finding 1", "Finding 2"],
      "recommendations": ["Recommendation 1", "Recommendation 2"],
      "riskLevel": "High",
      "confidenceScore": 0.85,
      "generatedBy": "Local LLM (Ollama)"
    }
  }
}
```

### 2. API Endpoints

#### Generate AI Report
```
POST /api/reports/generate-from-assessment
Authorization: Bearer <doctor_token>
Body: { assessmentId, childId, additionalNotes }
```

#### Get Report by Assessment
```
GET /api/reports/assessment/:assessmentId
Authorization: Bearer <token>
```

#### Get All Reports for Child
```
GET /api/reports/:childId
Authorization: Bearer <token>
```

#### Manual Report (Traditional)
```
POST /api/reports/add
Body: { childId, text, pdfUrl }
```

---

## Model Selection Guide

### For Development/Testing:
- **llama2** (7B) - Fast, good quality, 4GB RAM
- **mistral** (7B) - Faster, very good quality, 4GB RAM

### For Production:
- **llama2:13b** - Better accuracy, 8GB RAM
- **meditron** - Medical-specific, best for healthcare, 8GB RAM

### System Requirements:
| Model | RAM | Speed | Quality |
|-------|-----|-------|---------|
| llama2 (7B) | 4GB | Fast | Good |
| mistral (7B) | 4GB | Very Fast | Very Good |
| llama2 (13B) | 8GB | Medium | Excellent |
| meditron (7B) | 4GB | Fast | Medical-focused |

---

## Configuration Options

### Temperature Settings
Lower temperature = More consistent, clinical responses
```javascript
// In local-llm-service.js
options: {
  temperature: 0.3, // 0.1-0.5 recommended for medical
  top_p: 0.9,
  top_k: 40
}
```

### Timeout Settings
```javascript
// Request timeout (60 seconds default)
{ timeout: 60000 }
```

### Model Selection
```bash
# Change model in .env
OLLAMA_MODEL=mistral

# Or use medical model
OLLAMA_MODEL=meditron
```

---

## Generated Report Format

### Report Structure:
```
AUTISM SCREENING ASSESSMENT REPORT
==========================================================

PATIENT INFORMATION:
- Name, Age, Gender, Assessment Date

ASSESSMENT DETAILS:
- Type, Score, Risk Level, Confidence

CLINICAL SUMMARY:
Comprehensive analysis of findings

KEY FINDINGS:
1. Finding one
2. Finding two
...

RECOMMENDATIONS:
1. Evidence-based recommendation
2. Next steps
...

DISCLAIMER:
Medical disclaimer text
```

---

## Troubleshooting

### Problem: Ollama not connecting
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Check port availability
netstat -an | grep 11434
```

### Problem: Slow generation
```bash
# Use smaller model
ollama pull mistral

# Update .env
OLLAMA_MODEL=mistral
```

### Problem: Out of memory
```bash
# Use 7B model instead of 13B
ollama pull llama2

# Or use rule-based fallback (no memory needed)
# System automatically falls back if Ollama unavailable
```

### Problem: Model not found
```bash
# List installed models
ollama list

# Pull required model
ollama pull llama2
```

---

## Privacy & Compliance

### HIPAA Compliance:
✅ **No external API calls** - All processing local
✅ **No data transmission** - Data never leaves your server
✅ **No third-party services** - Complete control
✅ **Audit trail** - All reports logged in database
✅ **Encrypted storage** - MongoDB encryption at rest

### Data Flow:
1. Assessment data → Local LLM (on your server)
2. LLM generates report → Saved to your database
3. No external services involved

---

## Performance Optimization

### 1. GPU Acceleration (Optional)
```bash
# Install CUDA for NVIDIA GPUs
# Ollama automatically uses GPU if available
# 5-10x faster than CPU
```

### 2. Model Caching
```bash
# Models are cached after first load
# Subsequent generations are faster
```

### 3. Concurrent Requests
```javascript
// System handles concurrent report generation
// Each request is independent
```

---

## Monitoring

### Check LLM Status:
```javascript
// GET /api/reports/llm-status (add this endpoint if needed)
const { isOllamaAvailable } = require('./utils/local-llm-service');

router.get('/llm-status', async (req, res) => {
  const available = await isOllamaAvailable();
  res.json({ 
    ollamaAvailable: available,
    fallbackMode: !available 
  });
});
```

### Logs:
```
[Local LLM] Starting assessment analysis...
[Local LLM] Using Ollama for analysis
[Report Generator] Report generated successfully
```

---

## Production Deployment

### Docker Setup (Optional):
```dockerfile
# Dockerfile for Ollama
FROM ollama/ollama

# Pull models
RUN ollama pull llama2

EXPOSE 11434
```

### Environment Variables:
```bash
OLLAMA_URL=http://ollama-container:11434
OLLAMA_MODEL=llama2
```

---

## Cost Comparison

### Local LLM (This System):
- **Initial Cost:** $0
- **Per Report:** $0
- **Monthly:** $0
- **Privacy:** Complete
- **Compliance:** Easy

### Cloud APIs (OpenAI, etc.):
- **Initial Cost:** $0
- **Per Report:** $0.01 - $0.10
- **Monthly:** $100 - $1000+ (high volume)
- **Privacy:** Concerns
- **Compliance:** Complex

---

## Future Enhancements

### Planned Features:
1. **Multi-model ensemble** - Combine multiple models
2. **Fine-tuned medical model** - Train on autism research
3. **PDF report generation** - Visual reports with charts
4. **Multilingual support** - Generate reports in multiple languages
5. **Voice report narration** - Text-to-speech integration

---

## Support Resources

### Documentation:
- Ollama Docs: https://github.com/ollama/ollama
- Model Library: https://ollama.ai/library
- LLaMA 2 Paper: https://arxiv.org/abs/2307.09288

### Community:
- Ollama Discord: https://discord.gg/ollama
- GitHub Issues: https://github.com/ollama/ollama/issues

---

## Quick Start Checklist

- [ ] Install Ollama
- [ ] Download model: `ollama pull llama2`
- [ ] Start Ollama: `ollama serve`
- [ ] Configure `.env` with OLLAMA_URL
- [ ] Restart backend server
- [ ] Test report generation endpoint
- [ ] Verify report quality

---

## Summary

This system provides **enterprise-grade medical report generation** using local AI models. No external APIs, complete privacy, HIPAA compliant, and $0 operational cost.

**Ready to use in production with automatic fallback to rule-based system if LLM unavailable.**

---

*Last Updated: 2025*
*Version: 1.0.0*
