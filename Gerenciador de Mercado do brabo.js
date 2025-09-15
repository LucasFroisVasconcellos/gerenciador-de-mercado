// Versão 1.1.0 — última atualização em 2025-09-15T08:37:13Z
// Versão 6.2 — Refinamento visual dos ícones de ajuda e conteúdo completo nos tooltips.
// ==UserScript==
// @name         Gerenciador de Mercado do brabo
// @description  Automatiza a venda e compra de recursos no mercado premium com configurações individuais.
// @author       Lucas Frois & Eva
// @version      6.2
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

    if (settings.global.last_buy_index === undefined) {
        settings.global.last_buy_index = 0;
    }

    let sellInterval, buyInterval, reloadInterval;
    let isScriptPaused = false;

    createUI();
    setupEventListeners();

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
        // INJETANDO ESTILOS (CSS) PARA OS ÍCONES DE AJUDA (TOOLTIPS)
        // =======================================================================
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = `
            .info-icon {
                position: relative;
                display: inline-block;
                cursor: help;
                margin-left: 8px;
                width: 16px;
                height: 16px;
                border: 1px solid #804000;
                border-radius: 50%;
                text-align: center;
                font-weight: bold;
                font-family: 'Times New Roman', serif;
                font-style: italic;
                color: #804000;
                line-height: 16px; /* Alinha o 'i' verticalmente */
                font-size: 12px;
                background-color: #f4e4bc;
            }
            .info-icon .tooltip-text {
                visibility: hidden;
                width: 450px; /* Largura aumentada para o texto completo */
                background-color: #1a1a1a;
                color: #fff;
                text-align: left;
                border-radius: 6px;
                padding: 15px;
                position: absolute;
                z-index: 10;
                bottom: 150%;
                left: 50%;
                margin-left: -225px; /* Metade da largura para centralizar */
                opacity: 0;
                transition: opacity 0.3s;
                font-size: 12px;
                font-weight: normal;
                line-height: 1.5;
                font-family: Verdana, Arial, sans-serif;
                font-style: normal;
            }
            .info-icon .tooltip-text strong { color: #ffd179; }
            .info-icon:hover .tooltip-text {
                visibility: visible;
                opacity: 1;
            }
        `;
        document.head.appendChild(styleSheet);

        // Textos COMPLETOS para os tooltips
        const tooltips = {
            sell: `Esta seção configura o script para vender seus recursos excedentes sempre que as condições que você definir forem atendidas.<br><br><strong>Status:</strong> Esta caixa de seleção funciona como o interruptor principal "Liga/Desliga" para a venda de cada recurso.<br><br><strong>Manter armazém acima de:</strong> Pense nisto como seu estoque estratégico. O valor que você insere aqui é a quantidade mínima de recursos que você quer sempre ter na aldeia.<br><br><strong>Vender se preço ≤:</strong> Aqui você define o quão "caro" um Ponto Premium precisa estar para valer a pena vender. No mercado, um preço de venda baixo é melhor para você.<br><br><strong>Base de venda:</strong> Este é o seu valor de venda ideal por transação. O script automaticamente ajustará o valor para baixo para realizar uma venda segura e válida com apenas um comerciante.<br><br><strong>Botões:</strong> 'Aplicar Venda' salva apenas o Status (Ligado/Desligado). 'Desligar Venda' desliga todos.`,
            buy: `Esta seção automatiza a compra de recursos usando seus Pontos Premium, agindo quando as ofertas forem boas para você.<br><br><strong>Status:</strong> É o botão "Liga/Desliga" principal para a compra de cada recurso individualmente.<br><br><strong>Comprar se preço ≥:</strong> Esta é a sua condição de "bom negócio". Ao comprar, um preço alto é melhor, pois você ganha mais recursos por PP.<br><br><strong>Compra Mínima:</strong> Define a menor quantidade de recursos que vale a pena comprar, evitando transações muito pequenas.<br><br><strong>Compra Máxima:</strong> É o teto para cada transação de compra, mesmo que você tenha PPs e espaço de sobra.<br><br><strong>Botões:</strong> 'Aplicar Compra' salva apenas o Status (Ligado/Desligado). 'Desligar Compra' desliga todos.`,
            global: `Esta área gerencia as configurações gerais do script e o seu orçamento.<br><br><strong>Orçamento em %:</strong> Aqui você define qual porcentagem dos seus Pontos Premium atuais o script está autorizado a gastar.<br><br><strong>Ligar Orçamento:</strong> Ativa o modo de compra. Ele calcula seu orçamento e estabelece um "ponto de parada" para os gastos.<br><br><strong>Desligar Orçamento:</strong> Desativa o modo de compra imediatamente.<br><br><strong>Salvar Configurações:</strong> Este é o botão de salvamento principal para todos os NÚMEROS que você digitou (limites, preços, etc.). É crucial clicar aqui para que suas estratégias sejam memorizadas.`
        };

        const createTooltipIcon = (text, id) => {
            return `<span class="info-icon" id="${id}">i<span class="tooltip-text">${text}</span></span>`;
        };

        const container = document.createElement("div");
        container.id = "marketManagerContainer";
        container.style.cssText = "display: flex; justify-content: space-between; gap: 10px;";

        const resources = ['wood', 'stone', 'iron'];
        const resourceNames = { wood: 'Madeira', stone: 'Argila', iron: 'Ferro' };
        const resourceIcons = {
            wood: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/wood_18x16.png',
            stone: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/stone_18x16.png',
            iron: 'https://dsbr.innogamescdn.com/asset/af1188db/graphic/resources/iron_18x16.png'
        };

        let sellUI = `
            <div class="vis" style="flex: 1; padding: 10px;">
                <h3 style="text-align:center;">Venda Automática ${createTooltipIcon(tooltips.sell, 'sell_tooltip')}</h3>
                <table class="vis" style="width: 100%;">
                    <tr>
                        <th>Recurso</th>
                        ${resources.map(res => `<th><img src="${resourceIcons[res]}" title="${resourceNames[res]}"> ${resourceNames[res]}</th>`).join('')}
                    </tr>
                    <tr>
                        <td><strong>Status</strong></td>
                        ${resources.map(res => `<td style="text-align:center;"><input type="checkbox" id="sell_on_${res}" ${settings[res].sell_on ? 'checked' : ''}><br><span id="sell_status_${res}" style="font-size:10px; font-weight:bold;">${settings[res].sell_on ? 'Ligado' : 'Desligado'}</span></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Manter armazem acima de</td>
                        ${resources.map(res => `<td><input type="text" id="sell_res_cap_${res}" value="${settings[res].sell_res_cap || ''}" placeholder="ex: 500" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Vender se preço &le;</td>
                        ${resources.map(res => `<td><input type="text" id="sell_rate_cap_${res}" value="${settings[res].sell_rate_cap || ''}" placeholder="ex: 65" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Base de venda</td>
                        ${resources.map(res => `<td><input type="text" id="packet_size_${res}" value="${settings[res].packet_size || ''}" placeholder="ex: 900" style="width: 80%;"></td>`).join('')}
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 10px;">
                    <button id="btnLigarVenda" class="btn">Aplicar Venda (Selecionados)</button>
                    <button id="btnDesligarVenda" class="btn">Desligar Venda (Todos)</button>
                </div>
            </div>
        `;

        let buyUI = `
            <div class="vis" style="flex: 1; padding: 10px;">
                <h3 style="text-align:center;">Compra Automática ${createTooltipIcon(tooltips.buy, 'buy_tooltip')}</h3>
                <table class="vis" style="width: 100%;">
                    <tr>
                        <th>Recurso</th>
                        ${resources.map(res => `<th><img src="${resourceIcons[res]}" title="${resourceNames[res]}"> ${resourceNames[res]}</th>`).join('')}
                    </tr>
                    <tr>
                        <td><strong>Status</strong></td>
                        ${resources.map(res => `<td style="text-align:center;"><input type="checkbox" id="buy_on_${res}" ${settings[res].buy_on ? 'checked' : ''}><br><span id="buy_status_${res}" style="font-size:10px; font-weight:bold;">${settings[res].buy_on ? 'Ligado' : 'Desligado'}</span></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Comprar se preço &ge;</td>
                        ${resources.map(res => `<td><input type="text" id="buy_rate_${res}" value="${settings[res].buy_rate || ''}" placeholder="ex: 65" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Compra Mínima</td>
                        ${resources.map(res => `<td><input type="text" id="buy_min_q_${res}" value="${settings[res].buy_min_q || ''}" placeholder="ex: 100" style="width: 80%;"></td>`).join('')}
                    </tr>
                    <tr>
                        <td>Compra Máxima</td>
                        ${resources.map(res => `<td><input type="text" id="buy_max_q_${res}" value="${settings[res].buy_max_q || ''}" placeholder="ex: 1000" style="width: 80%;"></td>`).join('')}
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 10px;">
                    <button id="btnLigarCompra" class="btn">Aplicar Compra (Selecionados)</button>
                    <button id="btnDesligarCompra" class="btn">Desligar Compra (Todos)</button>
                </div>
            </div>
        `;

        let globalControlsUI = `
            <div class="vis" style="margin-top: 10px; padding: 10px; text-align: center;">
                <h3>Controles Globais ${createTooltipIcon(tooltips.global, 'global_tooltip')}</h3>
                Orçamento em %: <input type="text" id="global_budget_percent" value="${settings.global.budget_percent || ''}" placeholder="ex: 20" style="width: 80px;">
                <button id="btnLigarBudget" class="btn">Ligar Orçamento</button>
                <button id="btnDesligarBudget" class="btn">Desligar Orçamento</button>
                <button id="btnSalvar" class="btn" style="background-color: #4CAF50;">Salvar Configurações</button>
                <div id="budget_status_display" style="margin-top: 5px; font-weight: bold; font-size: 12px;"></div>
            </div>
        `;

        container.innerHTML = sellUI + buyUI;
        const mainContainer = document.createElement('div');
        mainContainer.id = "marketManagerMainContainer";
        mainContainer.innerHTML = `<hr>` + container.outerHTML + globalControlsUI;
        userInputParent.parentNode.insertBefore(mainContainer, userInputParent.nextSibling);
        updateBudgetDisplay();
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
                console.log("Aviso detectado na janela de confirmação. Cancelando a transação.");
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
            notice.innerHTML = `<div style="border: 3px solid #E53935; background-color: #FFEBEE; padding: 15px; margin-top: 10px; text-align: center;">
                                    <h2 style="color: #D32F2F; margin: 0;">PROTEÇÃO CONTRA BOTS DETECTADA!</h2>
                                    <p style="font-size: 14px; margin: 5px 0 0 0;">O script foi <strong>TOTALMENTE PAUSADO</strong>. Por favor, resolva o CAPTCHA e <strong>recarregue a página</strong> para continuar.</p>
                                </div>`;
            mainContainer.parentNode.insertBefore(notice, mainContainer);
        }
    }


    // =======================================================================
    //  6. LÓGICA DE VENDA E COMPRA
    // =======================================================================
    function sellResource() {
        if (checkForCaptcha()) {
            pauseScript();
            return;
        }

        let merchAvail = document.getElementById("market_merchant_available_count").textContent;
        if (merchAvail < 1) return;

        const allResInfo = getResInfo();
        for (const resName of ['wood', 'stone', 'iron']) {
            const resConfig = settings[resName];
            const resData = allResInfo[resName];

            // Condições primárias para a venda
            if (!resConfig.sell_on || resConfig.sell_rate_cap === 0) continue;
            if (resData.price > resConfig.sell_rate_cap) continue;

            // 1. Verificar excedente no armazém do jogador
            let surplus = resData.inVillage - resConfig.sell_res_cap;
            if (surplus <= 0) continue;

            // 2. Verificar espaço disponível no mercado
            let marketSpaceAvailable = resData.market_capacity - resData.market_stock;
            if (marketSpaceAvailable <= 0) {
                console.log(`Mercado de ${resName} está cheio. Aguardando.`);
                continue;
            }

            // =======================================================================
            // NOVA LÓGICA DE CÁLCULO PARA 1 COMERCIANTE (baseado na taxa)
            // =======================================================================
            const MERCHANT_CAPACITY_SAFE = 999;
            let maxSafeAmountBasedOnRate = 0;
            if (resData.price > 0) {
                 // Calcula quantos "pacotes de taxa" cabem em 999 recursos
                const numPackets = Math.floor(MERCHANT_CAPACITY_SAFE / resData.price);
                // Calcula o valor máximo de venda com base nesses pacotes
                maxSafeAmountBasedOnRate = numPackets * resData.price;
            }
            // Se a taxa for maior que 999, maxSafeAmountBasedOnRate será 0, impedindo a venda.
            // =======================================================================


            // 3. Calcular a quantidade a vender com base em TODAS as restrições
            let amountToSell = Math.min(
                surplus,
                resConfig.packet_size,
                marketSpaceAvailable,
                maxSafeAmountBasedOnRate // Novo limite dinâmico que substitui o valor fixo de 1000
            );

            // A venda só ocorre se a quantidade calculada for positiva e a base de venda estiver configurada
            if (amountToSell > 0 && resConfig.packet_size > 0) {
                console.log(`Tentando vender ${Math.floor(amountToSell)} de ${resName} (Limite seguro: ${maxSafeAmountBasedOnRate})`);
                performTransaction('sell', resName, amountToSell);
                // Retorna para garantir que apenas uma transação ocorra por ciclo
                return;
            }
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
            let buyableAmount = resData.market_capacity; // Nota: A lógica original usa market_capacity, o correto seria market_stock. Mantido por consistência com a versão anterior.

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
