# Copy pt-BR — Casa dos Frios

Locked strings for MVP. Do not invent alternate status labels.

## Brand

| Key | String |
|---|---|
| marca | Casa dos Frios |
| hero_headline | Frios e carnes no atacado, com atendimento no WhatsApp. |
| hero_support | Cadastro CNPJ, orçamento e pedido em um só lugar. |
| logo_unavailable | Logo indisponível |
| logo_placeholder_alt | Casa dos Frios |

## Auth

| Key | String |
|---|---|
| login_title_saas | Entrar no SaaS |
| login_title_loja | Entrar na loja |
| email | E-mail |
| password | Senha |
| submit_login | Entrar |
| logout | Sair |
| login_error | E-mail ou senha inválidos. |
| account_disabled | Conta desativada. |
| session_expired | Sua sessão expirou. Entre novamente. |

## Loja chrome / CTAs

| Key | String |
|---|---|
| nav_catalogo | Catálogo |
| nav_cadastro | Cadastro |
| nav_carrinho | Carrinho |
| nav_meus_docs | Meus documentos |
| cta_whatsapp | WhatsApp |
| cta_ver_catalogo | Ver catálogo |
| cta_cadastrar | Quero me cadastrar |
| add_to_cart | Adicionar |
| sem_estoque | Sem estoque |
| moq | Qtd. mín. {n} un |
| price_atacado | Atacado |
| checkout | Enviar pedido |
| cart_empty | Seu carrinho está vazio. |
| catalog_empty | Nenhum produto visível na loja. |

## Cadastro

| Key | String |
|---|---|
| cadastro_title | Cadastro atacadista |
| cnpj | CNPJ |
| razao_social | Razão social |
| contato | Nome do contato |
| whatsapp | WhatsApp |
| cadastro_submit | Enviar cadastro |
| cadastro_ok | Cadastro enviado. Aguarde aprovação. |
| cadastro_pendente_gate | Seu cadastro ainda não foi aprovado. Você será avisado no WhatsApp. |
| cnpj_invalid | CNPJ inválido. |
| registry_down | Não consultamos o CNPJ agora. Você pode continuar e completar os dados. |
| registry_pending_badge | Registro pendente |
| approve | Aprovar |
| refuse | Recusar |
| refuse_reason | Motivo da recusa |
| refuse_reason_required | Informe o motivo da recusa. |
| status_pendente | Pendente |
| status_aprovado | Aprovado |
| status_recusado | Recusado |

## Cadastro gate (SaaS)

| Key | String |
|---|---|
| gate_not_approved | Cadastro não aprovado. Aprove o cadastro antes de continuar. |
| error_cadastro_nao_aprovado | Cliente sem cadastro aprovado. |

## Orçamento statuses

| Status | Label |
|---|---|
| rascunho | Rascunho |
| enviado | Enviado |
| aceito | Aceito |
| recusado | Recusado |
| expirado | Expirado |
| cancelado | Cancelado |

| Key | String |
|---|---|
| orcamento_novo | Novo orçamento |
| orcamento_enviar | Enviar orçamento |
| orcamento_aceitar | Aceitar orçamento |
| orcamento_recusar | Recusar orçamento |
| orcamento_expired | Este orçamento expirou. |
| valido_ate | Válido até |

## Pedido statuses

| Status | Label |
|---|---|
| confirmado | Confirmado |
| em_separacao | Em separação |
| despachado | Despachado |
| entregue | Entregue |
| cancelado | Cancelado |

| Key | String |
|---|---|
| pedido_novo | Novo pedido |
| pedido_ok | Pedido confirmado. |
| to_em_separacao | Iniciar separação |
| to_despachado | Marcar despachado |
| to_entregue | Marcar entregue |
| cancel_pedido | Cancelar pedido |

## Venda statuses

| Status | Label |
|---|---|
| rascunho | Rascunho |
| faturado | Faturado |
| cancelado | Cancelado |

| Key | String |
|---|---|
| faturar | Faturar |
| confirmar_faturamento | Confirmar faturamento |
| venda_stub_banner | Faturamento interno (stub) — sem NF-e. |
| venda_faturada | Faturamento interno registrado (stub). |

## Inbox (legacy keys — map UI to CRM)

| Key | String |
|---|---|
| inbox_title | Conversas |
| inbox_empty | Nenhuma conversa ainda. |
| simulate_message | Simular mensagem |
| simulate_ok | Mensagem simulada adicionada. |
| intent | Label |
| intent_cadastro | Cadastro |
| intent_orcamento | Orçamento |
| intent_info_empresa | Info empresa |
| intent_outro | Outro |
| outbox_stub_note | Registrado (stub). |

## CRM desk (Phase A)

| Key | String |
|---|---|
| nav_conversas | Conversas |
| nav_contatos | Contatos |
| nav_empresas | Empresas |
| nav_labels | Labels |
| nav_equipes | Equipes |
| nav_respostas_rapidas | Respostas rápidas |
| nav_caixas | Caixas de entrada |
| nav_notificacoes | Notificações |
| nav_perfil_crm | Perfil |
| nav_relatorios | Relatórios |
| conversas_title | Conversas |
| conversas_empty | Nenhuma conversa ainda. |
| conversas_empty_filter | Nenhuma conversa neste filtro. |
| conversas_filter_mine | Minhas |
| conversas_filter_unassigned | Não atribuídas |
| conversas_filter_open | Abertas |
| conversas_filter_pending | Pendentes |
| conversas_filter_snoozed | Adiadas |
| conversas_filter_resolved | Resolvidas |
| conversas_clear_filters | Limpar filtros |
| status_open | Aberta |
| status_pending | Pendente |
| status_snoozed | Adiada |
| status_resolved | Resolvida |
| priority_low | Baixa |
| priority_medium | Média |
| priority_high | Alta |
| priority_urgent | Urgente |
| assign | Atribuir |
| team | Equipe |
| private_note | Nota privada |
| send_reply | Enviar |
| snooze | Adiar |
| mute | Silenciar |
| bulk_actions | Ações em massa |
| viewing_collision | {nome} está vendo esta conversa. |
| sse_poll_fallback | Atualizando a cada 15s… |
| contatos_title | Contatos |
| contatos_empty | Nenhum contato. |
| contato_novo | Novo contato |
| contato_nova_conversa | Nova conversa |
| empresas_title | Empresas |
| empresas_empty | Nenhuma empresa. |
| empresa_nova | Nova empresa |
| labels_title | Labels |
| labels_empty | Nenhum label. |
| label_create | Criar label |
| label_system | Sistema |
| equipes_title | Equipes |
| equipes_empty | Nenhuma equipe. |
| equipe_create | Criar equipe |
| equipe_members | Membros |
| respostas_title | Respostas rápidas |
| respostas_empty | Nenhuma resposta rápida. |
| resposta_create | Criar resposta |
| resposta_shortcode | Atalho |
| caixas_title | Caixas de entrada |
| caixa_members | Membros da caixa |
| canal_title | Canal WhatsApp |
| canal_not_configured | Não configurado |
| canal_credentials_saved | Credenciais salvas |
| canal_ready_stub | Pronto para conectar |
| canal_mark_ready | Marcar pronto para conectar |
| canal_stub_alert | Envio e recebimento reais aguardam integração Meta aprovada. Você pode salvar credenciais e simular mensagens. |
| canal_secrets_change | Alterar |
| canal_templates | Modelos (cache stub) |
| notificacoes_empty | Nenhuma notificação. |
| notificacoes_prefs | Preferências de notificação |
| perfil_availability | Disponibilidade |
| availability_online | Online |
| availability_busy | Ocupado |
| availability_offline | Offline |
| perfil_signature | Assinatura |
| search_placeholder | Buscar conversas, contatos, mensagens… |
| search_empty | Nenhum resultado para “{q}”. |
| relatorios_stub | Relatórios na fase C. |
| phase_later_tooltip | Em breve — fase {phase} |

## Notify lines

| canais_aviso | String |
|---|---|
| whatsapp | Cliente avisado no WhatsApp. |
| email | Cliente avisado por e-mail. |
| ambos | Cliente avisado no WhatsApp e por e-mail. |
| seller_same | Vendedor avisado no mesmo canal. |

## Admin / users

| Key | String |
|---|---|
| users_title | Usuários |
| user_create | Criar usuário |
| user_deactivate | Desativar |
| user_deactivate_confirm | Desativar este usuário? Ele não poderá entrar. |
| role_admin | Admin |
| role_vendedor | Vendedor |
| theme_title | Tema |
| theme_save | Salvar tema |
| theme_contrast_fail | Contraste insuficiente. Ajuste as cores. |
| config_title | Configuração |
| avisos_title | Avisos |

## Estoque

| Key | String |
|---|---|
| estoque_title | Estoque |
| estoque_empty | Nenhum produto cadastrado. |
| novo_produto | Novo produto |
| editar_produto | Editar produto |
| codigo_sku | Código (SKU) |
| descricao | Descrição |
| unidade | Unidade |
| preco_venda | Preço de venda |
| desconto_max | Desconto máx. (%) |
| desconto | Desconto (%) |
| qtd_min_atacado | Qtd. mínima (atacado) |
| estoque_inicial | Estoque inicial |
| ativo | Ativo |
| movimentos | Movimentos |
| on_hand | Em estoque |
| reserved | Reservado |
| available | Disponível |
| visivel_loja | Visível na loja |
| adjust_qty | Ajustar quantidade |
| motivo | Motivo |
| lista_preco | Preço lista |
| preco_liquido | Preço líquido |

## Aparência (color mode)

| Key | String |
|---|---|
| color_mode | Aparência |
| color_mode_light | Claro |
| color_mode_dark | Escuro |
| color_mode_system | Sistema |

## Shared errors / empty

| Key | String |
|---|---|
| load_fail | Não foi possível carregar. |
| retry | Tentar de novo |
| save_fail | Não foi possível concluir. |
| not_found | Não encontrado. |
| discard_theme | Descartar alterações do tema? |
