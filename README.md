# J.A.R.V.I.S. — Assistente web com Fish Audio

Aplicação web simples com:
- Palavra de ativação "Jarvis" via Web Speech API do navegador.
- Respostas da OpenAI Responses API.
- Voz personalizada do Fish Audio TTS.
- Interface adaptada para celular.

## Requisitos
- Node.js 20 ou superior.
- Chave de API da OpenAI.
- Chave de API do Fish Audio.
- Voice ID da voz escolhida.
- Google Chrome atualizado no Android.
- HTTPS em produção (necessário para microfone).

## Rodar localmente
1. Descompacte o projeto.
2. Abra um terminal na pasta do projeto.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Preencha as três variáveis:
   - `OPENAI_API_KEY`
   - `FISH_AUDIO_API_KEY`
   - `FISH_VOICE_ID`
6. Opcional: altere `OPENAI_MODEL` para outro modelo habilitado na sua conta.
7. Execute `npm start`.
8. Abra `http://localhost:3000` no computador.

## Publicar para acessar pelo celular
Publique em um serviço Node.js que ofereça HTTPS (por exemplo, Render, Railway ou outro host compatível).
Configure as variáveis de ambiente no painel do host. Não envie o arquivo `.env` para GitHub.
Depois de publicar, abra o endereço HTTPS no Chrome do Android e permita o microfone.

## Como conversar
1. Toque em **ATIVAR ESCUTA**.
2. Diga "Jarvis, que horas são?" ou apenas "Jarvis" e depois faça a pergunta.
3. O assistente processa a pergunta, gera uma resposta e reproduz o áudio do Fish Audio.
4. A escuta é pausada durante a reprodução para evitar que o microfone transcreva a própria voz.

## Limitações importantes
- O reconhecimento de voz usa `SpeechRecognition` / `webkitSpeechRecognition`, que depende do navegador e de serviços de reconhecimento disponíveis. Chrome Android costuma oferecer suporte, mas não é garantido em todos os dispositivos/versões.
- A página precisa permanecer aberta, em primeiro plano e com o microfone permitido. Não é um assistente sempre ativo com tela bloqueada.
- O navegador pode encerrar o reconhecimento; o código tenta reiniciá-lo enquanto a página está ativa.
- A reprodução de áudio pode exigir uma interação inicial do usuário.
- Este é um protótipo: não possui autenticação de usuário, banco de dados ou proteção contra abuso. Antes de compartilhar publicamente, adicione autenticação, limites de uso e controles de custo.
- A voz escolhida deve ser usada conforme as permissões e termos do Fish Audio e do titular da voz.
