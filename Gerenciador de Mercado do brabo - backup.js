// Versão 1.1.2 — última atualização em 2025-09-15T21:35:35Z
// Versão 6.6 — Refatorado sistema de tooltips para renderizar sobre a UI do jogo e evitar cortes.
// ==UserScript==
// @name         Gerenciador de Mercado do brabo
// @description  Automatiza a venda e compra de recursos no mercado premium com configurações individuais.
// @author       Lucas Frois & Eva
// @version      6.6
// @include      https://*/game.php*screen=market*
// ==/UserScript==

(function() {
    'use strict';

    // =======================================================================
    //  1. CONFIGURAÇÕES E ESTADO INICIAL
    // =======================================================================

    const defaultConfig = {
        wood: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        stone: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        iron: { sell_on: false, buy_on: false, sell_res_cap: 0, sell_rate_cap: 0, packet_size: 0, buy_rate: 0, buy_min_q: 0, buy_max_q: 0 },
        global: { budget_percent: 0, budget_on: false, pp_start: null, pp_stop: null, last_buy_index: 0 }
    };

    let settings = JSON.parse(localStorage.getItem('marketManagerSettings_v5')) || defaultConfig;
    let isWaitingForMerchants = false; // Estado de espera por comerciantes

    if (settings.global.last_buy_index === undefined) {
        settings.global.last_buy_index = 0;
    }

    let sellInterval, buyInterval, reloadInterval;
    let isScriptPaused = false;

    // Atraso na inicialização para garantir que o DOM do jogo esteja pronto
    setTimeout(() => {
        createUI();
        setupEventListeners();
    }, 500);


    // =======================================================================
    //  2. LOOPS PRINCIPAIS (TIMERS)
    // =======================================================================
    sellInterval = setInterval(sellResource, 8000);
    buyInterval = setInterval(buyResource, 9500);
    reloadInterval = setInterval(() => { if (!isScriptPaused) window.location.reload(); }, 300000);

    // =======================================================================
    //  3. CRIAÇÃO DA INTERFACE (UI)
    // =======================================================================
    function createUI() {
        const userInputParent = document.getElementById("premium_exchange_form");
        if (!userInputParent) return;

        // =======================================================================
        // INJETANDO ESTILOS (CSS) PARA OS ÍCONES DE AJUDA E AVISOS
        // =======================================================================
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = `
            .info-icon {
                position: relative; display: inline-block; cursor: help; margin-left: 8px;
                width: 16px; height: 16px; border: 1px solid #804000; border-radius: 50%;
                text-align: center; font-weight: bold; font-family: 'Times New Roman', serif;
                font-style: italic; color: #804000; line-height: 16px; font-size: 12px;
                background-color: #f4e4bc;
            }
            /* O tooltip agora é um elemento separado, posicionado de forma fixa na tela */
            .tooltip-text {
                visibility: hidden; opacity: 0;
                width: 450px; background-color: #1a1a1a; color: #fff;
                text-align: left; border-radius: 6px; padding: 15px;
                position: fixed; /* MUDANÇA CRÍTICA: Posição fixa para sobrepor tudo */
                z-index: 10001; /* Z-index muito alto para garantir que fique na frente */
                transition: opacity 0.3s;
                font-size: 12px; font-weight: normal; line-height: 1.5;
                font-family: Verdana, Arial, sans-serif; font-style: normal;
                pointer-events: none; /* Impede que o próprio tooltip intercepte eventos do mouse */
            }
            .tooltip-text strong { color: #ffd179; }
            .standby-notice {
                display: none; border: 2px solid #ff8c00; background-color: #fff5e1;
                padding: 10px; margin-bottom: 10px; text-align: center;
                font-weight: bold; color: #533600;
            }
        `;
        document.head.appendChild(styleSheet);

        const tooltips = {
            sell: `Esta seção configura o script para vender seus recursos excedentes sempre que as condições que você definir forem atendidas.<br><br><strong>Status:</strong> Esta caixa de seleção funciona como o interruptor principal "Liga/Desliga" para a venda de cada recurso.<br><br><strong>Manter armazém acima de:</strong> Pense nisto como seu estoque estratégico. O valor que você insere aqui é a quantidade mínima de recursos que você quer sempre ter na aldeia. Por exemplo, se você colocar "50000", o script nunca fará uma venda que deixe seu armazém com menos de 50.000 daquele recurso.<br><br><strong>Vender se preço ≤:</strong> Aqui você define o quão "caro" um Ponto Premium precisa estar para valer a pena vender. No mercado, um preço de venda baixo é melhor para você. Se você definir este campo como "400", o script só irá vender se o mercado estiver pagando 400 ou menos recursos por 1 PP.<br><br><strong>Base de venda:</strong> Este é o seu valor de venda ideal por transação. Por exemplo, se você colocar "900", o script tentará vender 900 recursos. No entanto, ele é inteligente: se para vender 900 recursos for necessário mais de um comerciante, ou se o mercado não tiver espaço, ele automaticamente ajustará o valor para baixo para realizar uma venda segura e válida.<br><br><strong>Botões:</strong> 'Aplicar Venda' salva apenas o Status (Ligado/Desligado). 'Desligar Venda' desliga todos.`,
            buy: `Esta seção automatiza a compra de recursos usando seus Pontos Premium, agindo quando as ofertas forem boas para você.<br><br><strong>Status:</strong> É o botão "Liga/Desliga" principal para a compra de cada recurso individualmente.<br><br><strong>Comprar se preço ≥:</strong> Esta é a sua condição de "bom negócio". Ao comprar, um preço alto é melhor, pois você ganha mais recursos por Ponto Premium. Se você colocar "600" aqui, o script só comprará recursos se o mercado estiver oferecendo 600 ou mais por 1 PP.<br><br><strong>Compra Mínima:</strong> Define a menor quantidade de recursos que vale a pena comprar. Isso evita que o script faça muitas compras pequenas. Por exemplo, se o valor for "1000", o script só executará uma compra se puder adquirir pelo menos 1.000 recursos de uma vez.<br><br><strong>Compra Máxima:</strong> É o teto para cada transação de compra. Mesmo que você tenha PPs e espaço de sobra, o script não comprará mais do que este valor em uma única operação. Se você definir como "5000", cada compra será de no máximo 5.000 recursos.<br><br><strong>Botões:</strong> 'Aplicar Compra' salva apenas o Status (Ligado/Desligado). 'Desligar Compra' desliga todos.`,
            global: `Esta área gerencia as configurações gerais do script e o seu orçamento.<br><br><strong>Orçamento em %:</strong> Ao clicar neste botão, o script ativa o modo de compra. Ele verifica quantos PPs você tem, calcula a porcentagem que você definiu e estabelece um "orçamento de gastos". Por exemplo, se você tem 5.000 PPs e definiu um orçamento de 20%, o script saberá que pode gastar 1.000 PPs e irá parar de comprar quando seu saldo atingir 4.000 PPs.<br><br><strong>Ligar Orçamento:</strong> Ativa o modo de compra. Ele calcula seu orçamento e estabelece um "ponto de parada" para os gastos.<br><br><strong>Desligar Orçamento:</strong> Desativa o modo de compra imediatamente.<br><br><strong>Salvar Configurações:</strong> Este é o botão de salvamento principal para todos os NÚMEROS que você digitou (limites, preços, etc.). É crucial clicar aqui para que suas estratégias sejam memorizadas.`
        };

        // MUDANÇA: Esta função agora cria o tooltip no body e retorna o ícone com uma referência a ele.
        const createTooltipIcon = (text, id) => {
            const tooltipId = `tooltip-for-${id}`;

            // Cria o elemento tooltip e o anexa ao body para evitar ser cortado
            const tooltipEl = document.createElement('span');
            tooltipEl.className = 'tooltip-text';
            tooltipEl.id = tooltipId;
            tooltipEl.innerHTML = text;
            document.body.appendChild(tooltipEl);

            // Retorna o HTML apenas para o ícone, com um atributo de dados para encontrar seu tooltip
            return `<span class="info-icon" data-tooltip-id="${tooltipId}" id="${id}">i</span>`;
        };

        const container = document.createElement("div");
        container.id = "marketManagerContainer";
        container.style.cssText = "display: flex; justify-content: space-between; gap: 10px;";
        const resources = ['wood', 'stone', 'iron'];
        const resourceNames = { wood: 'Madeira', stone: 'Argila', iron: 'Ferro' };
        const resourceIcons = { wood: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/wood_18x16.png', stone: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/stone_18x16.png', iron: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/iron_18x16.png' };

        let sellUI = `<div class="vis" style="flex: 1; padding: 10px;"><h3 style="text-align:center;">Venda Automática ${createTooltipIcon(tooltips.sell, 'sell_tooltip')}</h3><table class="vis" style="width: 100%;"><tr><th>Recurso</th>${resources.map(res => `<th><img src="${resourceIcons[res]}" title="${resourceNames[res]}"> ${resourceNames[res]}</th>`).join('')}</tr><tr><td><strong>Status</strong></td>${resources.map(res => `<td style="text-align:center;"><input type="checkbox" id="sell_on_${res}" ${settings[res].sell_on ? 'checked' : ''}><br><span id="sell_status_${res}" style="font-size:10px; font-weight:bold;">${settings[res].sell_on ? 'Ligado' : 'Desligado'}</span></td>`).join('')}</tr><tr><td>Manter armazem acima de</td>${resources.map(res => `<td><input type="text" id="sell_res_cap_${res}" value="${settings[res].sell_res_cap || ''}" placeholder="ex: 500" style="width: 80%;"></td>`).join('')}</tr><tr><td>Vender se preço &le;</td>${resources.map(res => `<td><input type="text" id="sell_rate_cap_${res}" value="${settings[res].sell_rate_cap || ''}" placeholder="ex: 65" style="width: 80%;"></td>`).join('')}</tr><tr><td>Base de venda</td>${resources.map(res => `<td><input type="text" id="packet_size_${res}" value="${settings[res].packet_size || ''}" placeholder="ex: 900" style="width: 80%;"></td>`).join('')}</tr></table><div style="text-align: center; margin-top: 10px;"><button id="btnLigarVenda" class="btn">Aplicar Venda (Selecionados)</button><button id="btnDesligarVenda" class="btn">Desligar Venda (Todos)</button></div></div>`;
        let buyUI = `<div class="vis" style="flex: 1; padding: 10px;"><h3 style="text-align:center;">Compra Automática ${createTooltipIcon(tooltips.buy, 'buy_tooltip')}</h3><table class="vis" style="width: 100%;"><tr><th>Recurso</th>${resources.map(res => `<th><img src="${resourceIcons[res]}" title="${resourceNames[res]}"> ${resourceNames[res]}</th>`).join('')}</tr><tr><td><strong>Status</strong></td>${resources.map(res => `<td style="text-align:center;"><input type="checkbox" id="buy_on_${res}" ${settings[res].buy_on ? 'checked' : ''}><br><span id="buy_status_${res}" style="font-size:10px; font-weight:bold;">${settings[res].buy_on ? 'Ligado' : 'Desligado'}</span></td>`).join('')}</tr><tr><td>Comprar se preço &ge;</td>${resources.map(res => `<td><input type="text" id="buy_rate_${res}" value="${settings[res].buy_rate || ''}" placeholder="ex: 65" style="width: 80%;"></td>`).join('')}</tr><tr><td>Compra Mínima</td>${resources.map(res => `<td><input type="text" id="buy_min_q_${res}" value="${settings[res].buy_min_q || ''}" placeholder="ex: 100" style="width: 80%;"></td>`).join('')}</tr><tr><td>Compra Máxima</td>${resources.map(res => `<td><input type="text" id="buy_max_q_${res}" value="${settings[res].buy_max_q || ''}" placeholder="ex: 1000" style="width: 80%;"></td>`).join('')}</tr></table><div style="text-align: center; margin-top: 10px;"><button id="btnLigarCompra" class="btn">Aplicar Compra (Selecionados)</button><button id="btnDesligarCompra" class="btn">Desligar Compra (Todos)</button></div></div>`;
        let globalControlsUI = `<div class="vis" style="margin-top: 10px; padding: 10px; text-align: center;"><h3>Controles Globais ${createTooltipIcon(tooltips.global, 'global_tooltip')}</h3>Orçamento em %: <input type="text" id="global_budget_percent" value="${settings.global.budget_percent || ''}" placeholder="ex: 20" style="width: 80px;"><button id="btnLigarBudget" class="btn">Ligar Orçamento</button><button id="btnDesligarBudget" class="btn">Desligar Orçamento</button><button id="btnSalvar" class="btn" style="background-color: #4CAF50;">Salvar Configurações</button><div id="budget_status_display" style="margin-top: 5px; font-weight: bold; font-size: 12px;"></div></div>`;

        container.innerHTML = sellUI + buyUI;
        const mainContainer = document.createElement('div');
        mainContainer.id = "marketManagerMainContainer";
        mainContainer.innerHTML = `
            <div id="merchant_standby_notice" class="standby-notice">Não há comerciantes disponíveis. Aguardando o retorno.</div>
            <hr>
            ${container.outerHTML}
            ${globalControlsUI}
        `;
        userInputParent.parentNode.insertBefore(mainContainer, userInputParent.nextSibling);
        updateBudgetDisplay();
        initializeIntelligentTooltips();
    }

    // =======================================================================
    //  FUNÇÃO DE TOOLTIPS TOTALMENTE REFEITA
    // =======================================================================
    function initializeIntelligentTooltips() {
        const infoIcons = document.querySelectorAll('.info-icon');
        const MARGIN = 10; // Espaço em pixels das bordas e do ícone

        infoIcons.forEach(icon => {
            const tooltipId = icon.getAttribute('data-tooltip-id');
            const tooltip = document.getElementById(tooltipId);
            if (!tooltip) return;

            const showTooltip = () => {
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';

                const iconRect = icon.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();

                // Calcula a posição inicial (centralizado, acima do ícone)
                let top = iconRect.top - tooltipRect.height - MARGIN;
                let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);

                // Ajusta para não sair pelas bordas da tela
                if (left < MARGIN) {
                    left = MARGIN;
                }
                if (left + tooltipRect.width > window.innerWidth - MARGIN) {
                    left = window.innerWidth - tooltipRect.width - MARGIN;
                }
                if (top < MARGIN) {
                    // Se sair pelo topo, inverte para baixo do ícone
                    top = iconRect.bottom + MARGIN;
                }

                tooltip.style.top = `${top}px`;
                tooltip.style.left = `${left}px`;
            };

            const hideTooltip = () => {
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
            };

            icon.addEventListener('mouseenter', showTooltip);
            icon.addEventListener('mouseleave', hideTooltip);
        });
    }


    // =======================================================================
    //  4. LÓGICA DOS CONTROLES (EVENT LISTENERS)
    // =======================================================================
    function setupEventListeners() {
        const resources = ['wood', 'stone', 'iron'];
        document.getElementById('btnSalvar').addEventListener('click', () => {
            resources.forEach(res => {
                settings[res].sell_res_cap = parseInt(document.getElementById(`sell_res_cap_${res}`).value) || 0;
                settings[res].sell_rate_cap = parseInt(document.getElementById(`sell_rate_cap_${res}`).value) || 0;
                settings[res].packet_size = parseInt(document.getElementById(`packet_size_${res}`).value) || 0;
                settings[res].buy_rate = parseInt(document.getElementById(`buy_rate_${res}`).value) || 0;
                settings[res].buy_min_q = parseInt(document.getElementById(`buy_min_q_${res}`).value) || 0;
                settings[res].buy_max_q = parseInt(document.getElementById(`buy_max_q_${res}`).value) || 0;
            });
            settings.global.budget_percent = parseInt(document.getElementById('global_budget_percent').value) || 0;
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Configurações de valores salvas!');
            location.reload();
        });
        document.getElementById('btnLigarVenda').addEventListener('click', () => {
            resources.forEach(res => {
                const isChecked = document.getElementById(`sell_on_${res}`).checked;
                settings[res].sell_on = isChecked;
                updateStatusDisplay('sell', res, isChecked);
            });
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Status de Venda salvo conforme selecionado!');
        });
        document.getElementById('btnDesligarVenda').addEventListener('click', () => {
            resources.forEach(res => {
                document.getElementById(`sell_on_${res}`).checked = false;
                settings[res].sell_on = false;
                updateStatusDisplay('sell', res, false);
            });
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Venda desativada e salva para todos os recursos!');
        });
        document.getElementById('btnLigarCompra').addEventListener('click', () => {
            if (!settings.global.budget_on) {
                const someBuyIsOn = resources.some(res => document.getElementById(`buy_on_${res}`).checked);
                if (someBuyIsOn) {
                    alert("Atenção: A compra automática só funcionará se o Orçamento Global estiver LIGADO. Por favor, ative o orçamento.");
                }
            }
            resources.forEach(res => {
                const isChecked = document.getElementById(`buy_on_${res}`).checked;
                settings[res].buy_on = isChecked;
                updateStatusDisplay('buy', res, isChecked);
            });
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Status de Compra salvo conforme selecionado!');
        });
        document.getElementById('btnDesligarCompra').addEventListener('click', () => {
            resources.forEach(res => {
                document.getElementById(`buy_on_${res}`).checked = false;
                settings[res].buy_on = false;
                updateStatusDisplay('buy', res, false);
            });
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            alert('Compra desativada e salva para todos os recursos!');
        });
        document.getElementById('btnLigarBudget').addEventListener('click', () => {
            let currentPP = parseInt(document.getElementById("premium_points").innerText);
            let budgetPercent = parseInt(document.getElementById('global_budget_percent').value) || settings.global.budget_percent;
            if (isNaN(currentPP) || isNaN(budgetPercent) || budgetPercent <= 0) {
                alert("Por favor, defina um orçamento de PP válido em %.");
                return;
            }
            let ppToSpend = currentPP * (budgetPercent / 100);
            settings.global.pp_start = currentPP;
            settings.global.pp_stop = currentPP - ppToSpend;
            settings.global.budget_on = true;
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            updateBudgetDisplay();
        });
        document.getElementById('btnDesligarBudget').addEventListener('click', () => {
            settings.global.budget_on = false;
            settings.global.pp_start = null;
            settings.global.pp_stop = null;
            localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
            updateBudgetDisplay();
        });
    }

    // =======================================================================
    //  5. FUNÇÕES AUXILIARES
    // =======================================================================
    function updateBudgetDisplay() {
        let display = document.getElementById("budget_status_display");
        if (settings.global.budget_on && settings.global.pp_start && settings.global.pp_stop) {
            display.textContent = `Orçamento Ativo: Gastar ${Math.round(settings.global.pp_start - settings.global.pp_stop)} PP. Parar em ${Math.round(settings.global.pp_stop)} PP.`;
        } else {
            display.textContent = "Orçamento Inativo.";
        }
    }

    function updateStatusDisplay(type, resource, isOn) {
        const statusSpan = document.getElementById(`${type}_status_${resource}`);
        if (statusSpan) {
            statusSpan.textContent = isOn ? 'Ligado' : 'Desligado';
        }
    }

    function getResInfo() {
        const resources = {};
        ['wood', 'stone', 'iron'].forEach((res, index) => {
            resources[res] = {
                price: parseInt(document.getElementById(`premium_exchange_rate_${res}`).children[0].innerText),
                inVillage: parseInt(document.getElementById(res).innerText),
                market_stock: parseInt(document.getElementById(`premium_exchange_stock_${res}`).innerHTML),
                market_capacity: parseInt(document.getElementById(`premium_exchange_capacity_${res}`).innerHTML)
            };
        });
        return resources;
    }

    function performTransaction(type, resource, amount) {
        document.querySelectorAll(`input.premium-exchange-input[data-type="${type}"]`).forEach(el => el.value = "");
        document.querySelector(`input.premium-exchange-input[name="${type}_${resource}"]`).value = Math.floor(amount);
        document.getElementsByClassName("btn-premium-exchange-buy")[0].click();

        setTimeout(() => {
            const warningElement = document.querySelector('#premium_exchange td.warn');
            if (warningElement && warningElement.offsetParent !== null) {
                // VERIFICA SE O AVISO É DE FALTA DE COMERCIANTES (GATILHO REATIVO)
                if (warningElement.textContent.includes('comerciante livre')) {
                    console.log("Aviso de falta de comerciantes detectado (reativo). Ativando modo de espera.");
                    isWaitingForMerchants = true;
                    document.getElementById('merchant_standby_notice').style.display = 'block';
                }
                const cancelButton = document.querySelector('.btn.evt-cancel-btn-confirm-no');
                if (cancelButton) {
                    cancelButton.click();
                }
            } else {
                const confirmButton = document.querySelector(".btn-confirm-yes");
                if (confirmButton) {
                    confirmButton.click();
                }
            }
        }, 2500);
    }

    function checkForCaptcha() {
        const captchaContainer = document.querySelector('td.bot-protection-row');
        const hcaptchaIframe = document.querySelector('iframe[src*="hcaptcha.com"]');
        if ((captchaContainer && captchaContainer.offsetParent !== null) || hcaptchaIframe) {
            return true;
        }
        return false;
    }

    function pauseScript() {
        if (isScriptPaused) return;
        isScriptPaused = true;
        console.log("CAPTCHA detectado! Pausando o script completamente.");
        clearInterval(sellInterval);
        clearInterval(buyInterval);
        clearInterval(reloadInterval);
        const mainContainer = document.getElementById("marketManagerMainContainer");
        if (mainContainer) {
            const notice = document.createElement('div');
            notice.innerHTML = `<div style="border: 3px solid #E53935; background-color: #FFEBEE; padding: 15px; margin-top: 10px; text-align: center;"><h2 style="color: #D32F2F; margin: 0;">PROTEÇÃO CONTRA BOTS DETECTADA!</h2><p style="font-size: 14px; margin: 5px 0 0 0;">O script foi <strong>TOTALMENTE PAUSADO</strong>. Por favor, resolva o CAPTCHA e <strong>recarregue a página</strong> para continuar.</p></div>`;
            mainContainer.parentNode.insertBefore(notice, mainContainer);
        }
    }

    // =======================================================================
    //  6. LÓGICA DE VENDA E COMPRA
    // =======================================================================
    function sellResource() {
        const merchAvail = parseInt(document.getElementById("market_merchant_available_count").textContent);

        // --- LÓGICA UNIFICADA DE ESPERA POR COMERCIANTES (invariável) ---
        if (isWaitingForMerchants) {
            if (merchAvail >= 2) {
                console.log("Comerciantes disponíveis. Retomando as vendas.");
                isWaitingForMerchants = false;
                document.getElementById('merchant_standby_notice').style.display = 'none';
            } else {
                console.log("Modo de espera: Aguardando 2 comerciantes livres...");
                return;
            }
        } else {
            if (merchAvail < 1) {
                console.log("Nenhum comerciante disponível (proativo). Ativando modo de espera.");
                isWaitingForMerchants = true;
                document.getElementById('merchant_standby_notice').style.display = 'block';
                return;
            }
        }

        if (checkForCaptcha()) {
            pauseScript();
            return;
        }

        const allResInfo = getResInfo();
        for (const resName of ['wood', 'stone', 'iron']) {
            const resConfig = settings[resName];
            const resData = allResInfo[resName];

            // Condições iniciais (preço, venda ligada)
            if (!resConfig.sell_on || resConfig.sell_rate_cap === 0) continue;
            if (resData.price > resConfig.sell_rate_cap) continue;

            // =======================================================================
            //  >>> INÍCIO DA LÓGICA MODIFICADA <<<
            // =======================================================================

            // Ponto de partida: a base de venda é o nosso alvo principal.
            const baseAmount = resConfig.packet_size;
            if (!baseAmount || baseAmount <= 0) continue; // Pula se não houver base de venda definida.

            const surplus = resData.inVillage - resConfig.sell_res_cap;

            // CONDIÇÃO PRIMÁRIA: Verifica se o excedente é suficiente para cobrir a base de venda.
            // Se o excedente for menor que a base, ele não tenta vender uma fração. Ele simplesmente passa para o próximo recurso.
            if (surplus < baseAmount) {
                continue;
            }

            // Checagem das restrições (espaço no mercado e capacidade do comerciante)
            const marketSpaceAvailable = resData.market_capacity - resData.market_stock;
            if (marketSpaceAvailable <= 0) {
                console.log(`Mercado de ${resName} está cheio. Aguardando.`);
                continue;
            }

            const MERCHANT_CAPACITY_SAFE = 999;
            let maxSafeAmountBasedOnRate = 0;
            if (resData.price > 0) {
                // Calcula a quantidade máxima de recursos que podem ser vendidos com 1 comerciante
                // sem exceder sua capacidade e resultando em um número inteiro de PP.
                const numPackets = Math.floor(MERCHANT_CAPACITY_SAFE / resData.price);
                maxSafeAmountBasedOnRate = numPackets * resData.price;
            }
            if (maxSafeAmountBasedOnRate <= 0) continue; // Não é possível vender com um comerciante

            // CÁLCULO FINAL: O valor a vender é o MENOR entre a base, o espaço no mercado e o limite do comerciante.
            // O 'surplus' não entra mais neste cálculo, pois já foi verificado na condição primária.
            let amountToSell = Math.min(baseAmount, marketSpaceAvailable, maxSafeAmountBasedOnRate);

            if (amountToSell > 0) {
                console.log(`Alvo de venda: ${baseAmount}. Restrições: [Espaço Mercado: ${marketSpaceAvailable}, Limite Comerciante: ${maxSafeAmountBasedOnRate}]. Vendendo ${Math.floor(amountToSell)} de ${resName}.`);
                performTransaction('sell', resName, amountToSell);
                return; // Sai da função após iniciar uma transação para evitar vendas múltiplas.
            }
            // =======================================================================
            //  >>> FIM DA LÓGICA MODIFICADA <<<
            // =======================================================================
        }
    }

    function buyResource() {
        if (checkForCaptcha()) {
            pauseScript();
            return;
        }
        if (!settings.global.budget_on) return;
        let currentPP = parseInt(document.getElementById("premium_points").innerText);
        if (settings.global.pp_stop && currentPP <= settings.global.pp_stop) {
            document.getElementById("btnDesligarBudget").click();
            return;
        }
        const allResInfo = getResInfo();
        const maxStorage = parseInt(document.getElementById("storage").innerText);
        const resourceOrder = ['wood', 'stone', 'iron'];
        let startIndex = settings.global.last_buy_index || 0;
        for (let i = 0; i < resourceOrder.length; i++) {
            let currentIndex = (startIndex + i) % resourceOrder.length;
            const resName = resourceOrder[currentIndex];
            const resConfig = settings[resName];
            if (!resConfig.buy_on) continue;
            const resData = allResInfo[resName];
            let warehouseSpace = maxStorage - resData.inVillage;
            let buyableAmount = resData.market_capacity;
            if (resData.price >= resConfig.buy_rate && buyableAmount >= resConfig.buy_min_q) {
                let buyThis = Math.min(buyableAmount, resConfig.buy_max_q, warehouseSpace);
                if (buyThis >= resConfig.buy_min_q) {
                    let transactionCost = Math.ceil(buyThis / resData.price);
                    if ((currentPP - transactionCost) >= settings.global.pp_stop) {
                        settings.global.last_buy_index = (currentIndex + 1) % resourceOrder.length;
                        localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
                        performTransaction('buy', resName, buyThis);
                        return;
                    } else {
                        console.log("Orçamento excederia com esta compra. Desligando a compra automática.");
                        document.getElementById("btnDesligarBudget").click();
                        return;
                    }
                }
            }
        }
        settings.global.last_buy_index = (startIndex + 1) % resourceOrder.length;
        localStorage.setItem('marketManagerSettings_v5', JSON.stringify(settings));
    }

})();
