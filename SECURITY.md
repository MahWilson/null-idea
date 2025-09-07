# 🔒 Security Guide - CodeNection AI Extension

## 🚨 **IMPORTANT: Security Considerations**

This extension integrates with AI services and processes documents. Please read this guide carefully to understand the security implications.

## 🛡️ **Security Features**

### **1. API Key Protection**
- **Never stored in plain text** in workspace settings
- **Environment variables** for sensitive configuration
- **Secure input handling** for API keys
- **No logging** of sensitive credentials

### **2. Document Processing Security**
- **Local processing only** - documents never leave your machine
- **Explicit user consent** - files only processed when you upload them
- **No background scanning** of your file system
- **Isolated storage** in VS Code extension context

### **3. Network Security**
- **HTTPS only** for API calls
- **No data exfiltration** - all processing is local
- **Configurable endpoints** - you control where data goes
- **Connection testing** before sending sensitive data

## 🔐 **Safe Configuration Methods**

### **Method 1: Environment Variables (Recommended)**
```bash
# Set these in your system environment
export OPENAI_API_KEY="your-key-here"
export OPENAI_ENDPOINT="https://api.openai.com/v1"
```

### **Method 2: VS Code Settings (Non-sensitive only)**
```json
{
  "codenection.ai.provider": "openai",
  "codenection.ai.model": "gpt-4",
  "codenection.ai.temperature": 0.7
}
```

### **Method 3: Secure Input (During runtime)**
- Use the "Configure AI Settings" command
- API keys entered are not persisted to disk
- Stored only in memory during the session

## ⚠️ **Security Risks & Mitigations**

### **Risk: API Key Exposure**
- **Mitigation**: Use environment variables, never commit keys to version control
- **Mitigation**: API keys are not saved in workspace settings
- **Mitigation**: Secure input handling with no logging

### **Risk: Data Leakage**
- **Mitigation**: All document processing is local
- **Mitigation**: No automatic file scanning
- **Mitigation**: User must explicitly choose files to process

### **Risk: Network Interception**
- **Mitigation**: HTTPS-only API calls
- **Mitigation**: Connection testing before use
- **Mitigation**: Configurable endpoints (avoid proxy risks)

### **Risk: Malicious Documents**
- **Mitigation**: Document processing is isolated
- **Mitigation**: No code execution from documents
- **Mitigation**: Text extraction only, no macros or scripts

## 🚀 **Safe Development Practices**

### **For Hackathon/Demo:**
1. **Use Mock Mode**: Default configuration is safe
2. **Test with Sample Docs**: Use non-sensitive test documents
3. **Local AI Models**: Consider Ollama for local development
4. **Environment Isolation**: Use separate API keys for development

### **For Production Use:**
1. **Rotate API Keys**: Regular key rotation
2. **Monitor Usage**: Track API calls and costs
3. **Access Control**: Limit who can configure AI settings
4. **Audit Logs**: Monitor document processing

## 🔍 **Security Checklist**

Before running with AI APIs:

- [ ] API keys stored in environment variables
- [ ] No sensitive documents in test environment
- [ ] HTTPS endpoints configured
- [ ] Connection testing successful
- [ ] Mock mode available as fallback
- [ ] No API keys in version control
- [ ] Document processing limited to test files

## 🆘 **Emergency Security Measures**

### **If API Key is Compromised:**
1. **Immediately revoke** the compromised key
2. **Generate new key** from your AI provider
3. **Update environment variables**
4. **Check for unauthorized usage**
5. **Review access logs**

### **If Malicious Document is Detected:**
1. **Stop processing** immediately
2. **Remove document** from extension storage
3. **Scan system** for other threats
4. **Review document source**
5. **Update security practices**

## 📋 **Configuration Examples**

### **Safe Development Setup:**
```bash
# .env file (never commit this!)
OPENAI_API_KEY=sk-...your-key-here
OPENAI_ENDPOINT=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-...your-key-here
ANTHROPIC_ENDPOINT=https://api.anthropic.com
```

### **VS Code Settings (safe to commit):**
```json
{
  "codenection.ai.provider": "openai",
  "codenection.ai.model": "gpt-4",
  "codenection.ai.temperature": 0.7,
  "codenection.ai.maxTokens": 1000
}
```

## 🎯 **Hackathon Security Tips**

1. **Start with Mock Mode**: Safe for demos
2. **Use Test Documents**: Sample markdown files
3. **Local Development**: Consider Ollama for local AI
4. **Environment Variables**: Set API keys in your shell
5. **No Production Data**: Keep sensitive docs away
6. **Connection Testing**: Verify before demo

## 📞 **Security Support**

If you discover a security issue:

1. **Do not post publicly** - security issues should be reported privately
2. **Contact the team** via secure channels
3. **Provide details** about the issue
4. **Include reproduction steps** if possible
5. **Wait for response** before public disclosure

## 🔒 **Final Security Note**

**This extension is designed with security in mind, but the ultimate responsibility for secure usage lies with you.** 

- Always use environment variables for API keys
- Test with non-sensitive documents
- Monitor your API usage and costs
- Keep your development environment secure
- Never commit secrets to version control

**Remember: Security is everyone's responsibility!** 🛡️ 