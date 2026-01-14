Analisando o projeto para sugerir funcionalidades adicionais para demonstração.


[4 tools called]


Sugestões de funcionalidades para adicionar ao projeto, organizadas por categoria:

## Funcionalidades sugeridas

### 1. Paginação e filtros avançados
- Paginação nos endpoints de listagem (`GET /employees`, `GET /users`)
- Ordenação (sort) por diferentes campos
- Busca/filtro por múltiplos campos (nome, email, etc.)
- Filtros combinados (ex: role + data de criação)

```typescript
// Exemplo de query params
GET /api/employees?page=1&limit=10&sort=name&order=ASC&role=ENGINEER&search=john
```

### 2. Relacionamentos entre entidades
- Tabela `Department` (departamentos)
- Relacionar `Employee` com `Department` (many-to-one)
- Endpoints para gestão de departamentos
- Listar funcionários por departamento

### 3. Upload de ficheiros
- Upload de foto de perfil para funcionários
- Armazenamento local ou cloud (AWS S3, Cloudinary)
- Validação de tipo e tamanho de ficheiro
- Endpoint para servir imagens

### 4. Auditoria e histórico
- Tabela de logs de ações (quem fez o quê e quando)
- Histórico de alterações em funcionários
- Soft delete (marcar como eliminado em vez de apagar)
- Endpoint para recuperar registos eliminados

### 5. Notificações e eventos
- Sistema de notificações (email, in-app)
- Eventos do NestJS (EventEmitter)
- Notificar quando um funcionário é criado/atualizado
- Newsletter ou notificações em massa

### 6. Cache e performance
- Cache com Redis ou in-memory
- Cache de listagens frequentes
- Endpoint de estatísticas (dashboard)
- Agregações (contagem por role, por departamento)

### 7. Testes automatizados
- Testes unitários para serviços
- Testes de integração para controllers
- Testes E2E para fluxos completos
- Coverage de código

### 8. Validação e transformação avançada
- Validação customizada (ex: email único)
- Transformação de dados com class-transformer
- Sanitização de inputs
- Validação de formatos (telefone, NIF, etc.)

### 9. Relatórios e exportação
- Exportação para PDF (funcionários)
- Exportação para Excel/CSV
- Geração de relatórios (ex: funcionários por mês)
- Gráficos e estatísticas

### 10. Funcionalidades de segurança
- Refresh tokens (além de sessões)
- Rate limiting por utilizador/IP
- Logs de segurança (tentativas de login falhadas)
- 2FA (autenticação de dois fatores)
- Política de senhas (complexidade, expiração)

### 11. WebSockets e tempo real
- Notificações em tempo real
- Chat ou sistema de mensagens
- Atualizações em tempo real de dados

### 12. Internacionalização (i18n)
- Suporte a múltiplos idiomas
- Mensagens de erro traduzidas
- Formatação de datas/números por locale

### 13. Health checks e monitorização
- Endpoint `/health` (saúde da aplicação)
- Health check da base de dados
- Métricas (Prometheus)
- Logging estruturado (Winston)

### 14. Documentação melhorada
- Exemplos de requests/responses no Swagger
- Postman collection
- README com exemplos de uso
- Diagramas de arquitetura

### 15. Funcionalidades de negócio
- Sistema de férias/ausências
- Avaliações de desempenho
- Projetos e tarefas
- Timesheet (registo de horas)

## Priorização recomendada

Alta prioridade (demonstração):
1. Paginação e filtros
2. Relacionamentos (Departments)
3. Upload de ficheiros
4. Testes automatizados
5. Health checks

Média prioridade:
6. Auditoria e histórico
7. Cache
8. Exportação (PDF/CSV)
9. Validações avançadas

Baixa prioridade (mais complexo):
10. WebSockets
11. 2FA
12. Relatórios avançados

Quer que detalhe a implementação de alguma destas funcionalidades?