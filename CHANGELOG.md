# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- OpenRouter provider (OpenAI-compatible, default model `openai/gpt-4.1-nano`), now the
  default when `OPENROUTER_API_KEY` is set. Hosted providers fall back to Ollama when they
  fail before answering.

### Fixed
- Streamed responses now report token usage, and usage records the actual provider.
