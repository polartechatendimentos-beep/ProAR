etSyncing(false); }
  };
  const pushToDatabase = async () => {
    if (!online) { setSavedMessage("Sem internet. Alterações pendentes serão sincronizadas ao reconectar."); return; }
    // Segurança multiaparelho: nunca força a cópia local como principal.
    await pullFromDatabase();
  };
  useEffect(() => {
    if (!online || !authenticatedUser) return;
    const synchronize = async () => {
      const queue = JSON.parse(localStorage.getItem("proar-offline-queue") || "[]") as { companyId: string; payload: unknown }[];
      if (!queue.length) return;
      const pending: typeof queue = [];
      for (const item of queue) { try { const response = await fetch(`/api/state?company=${encodeURIComponent(item.companyId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.payload) }); if (response.status === 409) { setSavedMessage("Havia alterações mais novas no servidor. A base online foi preservada; revise a alteração feita offline."); continue; } if (!response.ok) pending.push(item); } catch { pending.push(item); } }
      localStorage.setItem("proar-offline-queue", JSON.stringify(pending));
      if (!pending.length) { setSavedMessage("Dados offline sincronizados com sucesso."); window.setTimeout(() => setSavedMessage(""), 3500); }
    };
    void synchronize();
  }, [online, authenticatedUser]);
  useEffect(() => {
    if (!online || !authenticatedUser) return;
    const refresh = () => { if (document.visibilityState === "visible" && !syncing) void pullFromDatabase(); };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [online, authenticatedUser, activeCompany.id, syncing]);
  const updateServiceOrder = async (updatedOrder: ServiceOrder) => {
    const updatedOrders = serviceOrders.map(order => order.id === updatedOrder.id ? updatedOrder : order);
    const reminderId = `LEM-${updatedOrder.id.replace(/\D/g, "")}`;
    let updatedModules = { ...moduleRecords };
    const currentReminders = updatedModules.Lembretes ?? [];
    if (updatedOrder.status === "Concluída" && updatedOrder.reminderEnabled && updatedOrder.reminderDate) {
      const customer = customerRecords.find(item => item.name === updatedOrder.client);
      const reminder: ModuleRecord = { id: reminderId, name: `Lembrete pós-serviço • ${updatedOrder.service}`, client: updatedOrder.client, description: updatedOrder.reminderMessage || "Está na hora de realizar a higienização preventiva do seu ar-condicionado.", reminderMessage: updatedOrder.reminderMessage || "Está na hora de realizar a higienização preventiva do seu ar-condicionado.", createdAt: new Date().toLocaleString("pt-BR"), status: "Agendado", date: updatedOrder.reminderDate, category: customer?.phone || "", serviceOrderId: updatedOrder.id };
      updatedModules = { ...updatedModules, Lembretes: [reminder, ...currentReminders.filter(item => item.id !== reminderId)] };
    } else if (!updatedOrder.reminderEnabled) {
      updatedModules = { ...updatedModules, Lembretes: currentReminders.filter(item => item.id !== reminderId) };
    }
    // Conclusão nunca apaga lançamentos anteriores: cria somente integrações ainda inexistentes.
    if (/conclu[ií]da/i.test(updatedOrder.status)) {
      const receivableId = `REC-${updatedOrder.id.replace(/\D/g, "")}`;
      const stockPrefix = `OS-${updatedOrder.id.replace(/\D/g, "")}-`;
      const hasReceivable = (updatedModules.Financeiro ?? []).some(item => item.id === receivableId || item.serviceOrderId === updatedOrder.id);
      const productsUsed = (updatedOrder.catalogItems ?? []).filter(item => item.kind === "Produto");
      if (!hasReceivable) updatedModules = { ...updatedModules, Financeiro: [{ id: receivableId, name: `Conta a receber • ${updatedOrder.id}`, client: updatedOrder.client, description: `Gerada pela conclusão da OS ${updatedOrder.id}`, createdAt: new Date().toLocaleString("pt-BR"), status: "Em aberto", date: new Date().toISOString().slice(0,10), value: 0, transactionType: "Receber", serviceOrderId: updatedOrder.id }, ...(updatedModules.Financeiro ?? [])] };
      const stockEntries = productsUsed.filter(item => !(updatedModules.Estoque ?? []).some(stock => stock.id === `${stockPrefix}${item.id}`)).map(item => ({ id: `${stockPrefix}${item.id}`, name: `Saída por OS • ${item.name}`, client: updatedOrder.client, description: `Movimentação vinculada à ${updatedOrder.id}`, createdAt: new Date().toLocaleString("pt-BR"), status: "Concluído", category: "Saída por OS", serviceOrderId: updatedOrder.id, kind: "Produto" as const }));
      if (stockEntries.length) updatedModules = { ...updatedModules, Estoque: [...stockEntries, ...(updatedModules.Estoque ?? [])] };
    }
    if (!navigator.onLine) throw new Error("Sem conexão com a internet.");
    const payload = { companyId: activeCompany.id, customers: customerRecords, serviceOrders: updatedOrders, moduleRecords: updatedModules, _baseRevision: stateRevision };
    const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409 && result.state) {
        const serverCustomers=result.state.customers??[]; const serverOrders=result.state.serviceOrders??[]; const serverModules=mergeImportedServices(result.state.moduleRecords??{});
        setCustomerRecords(serverCustomers); setServiceOrders(serverOrders); setModuleRecords(serverModules); setStateRevision(Number(result.state._revision||0));
        localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(serverCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(serverOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(serverModules));
      }
      throw new Error(result.error || "Não foi possível confirmar a gravação no banco.");
    }
    const confirmedCustomers=result.state?.customers??customerRecords; const confirmedOrders=result.state?.serviceOrders??updatedOrders; const confirmedModules=mergeImportedServices(result.state?.moduleRecords??updatedModules);
    setCustomerRecords(confirmedCustomers); setServiceOrders(confirmedOrders); setModuleRecords(confirmedModules); setSelectedOrder(updatedOrder); setStateRevision(Number(result.state?._revision||stateRevision+1));
    localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(confirmedCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(confirmedOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(confirmedModules));
    // O acompanhamento externo recebe somente o recorte liberado ao cliente;
    // observações internas, financeiro e demais dados operacionais ficam na base autenticada.
    if (updatedOrder.trackingToken) {
      const timeline = (updatedOrder.timeline ?? []).filter(event => event.customerVisible).map(event => ({ id:event.id, createdAt:event.createdAt, status:event.status, customerNote:event.customerNote, photos:event.photos, customerVisible:true }));
      void fetch("/api/public-service-order", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ companyId:activeCompany.id, orderId:updatedOrder.id, token:updatedOrder.trackingToken, client:updatedOrder.client, service:updatedOrder.service, date:updatedOrder.date, time:updatedOrder.time, status:updatedOrder.status, timeline }) });
    }
    setSavedMessage(updatedOrder.status === "Concluída" && updatedOrder.reminderEnabled ? `Ordem ${updatedOrder.id} concluída e lembrete agendado.` : `Ordem ${updatedOrder.id} atualizada e sincronizada.`);
    window.setTimeout(() => setSavedMessage(""), 2500);
    return updatedOrder;
  };
  const hasAction = (moduleName: string, action: "Visualizar" | "Criar" | "Editar" | "Excluir") => Boolean(authenticatedUser?.permissions?.includes("*") || authenticatedUser?.role === "Administrador" || authenticatedUser?.permissions?.includes(`${moduleName}:${action}`));
  const updateCustomer = (updatedCustomer: Customer) => {
    const updatedCustomers = customerRecords.map(customer => customer.id === updatedCustomer.id ? updatedCustomer : customer);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    setSavedMessage(`Cliente ${updatedCustomer.name} atualizado com sucesso.`);
    window.setTimeout(() => setSavedMessage(""), 2500);
  };
  const appendAudit = (modules: Record<string, ModuleRecord[]>, action: string, reference: string, detail: string) => ({ ...modules, Auditoria: [{ id: `AUD-${Date.now()}`, name: action, client: authenticatedUser?.displayName || "Sistema", description: `${reference} • ${detail}`, createdAt: new Date().toLocaleString("pt-BR"), status: "Registrado", category: "Rastreabilidade" }, ...(modules.Auditoria ?? [])].slice(0, 1000) });
  const convertBudget = (budget: ModuleRecord, target: "Pedido" | "Ordem de serviço") => {
    if (target === "Pedido") {
      const sale: ModuleRecord = { ...budget, id:`VEN-${Date.now().toString().slice(-6)}`, name:`Pedido • ${budget.name}`, status:"Pedido confirmado", createdAt:new Date().toLocaleString("pt-BR") };
      const updated = { ...moduleRecords, Vendas:[sale,...(moduleRecords.Vendas ?? [])], Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em pedido"} : item) };
      setModuleRecords(updated); persistSharedState(customerRecords, serviceOrders, updated); setCurrent("Vendas");
    } else {
      const customer = customerRecords.find(item => item.name === budget.client);
      const order: ServiceOrder = { id:`#OS-${String(Math.max(15499,...serviceOrders.map(item => Number(item.id.replace(/\D/g,""))||0))+1).padStart(5,"0")}`, client:budget.client, unit:budget.unit || "Matriz", service:budget.purchaseItems?.map(item => item.description).join(", ") || budget.name, tech:"Não definido", date:new Date().toISOString().slice(0,10), time:"A definir", address:(budget.unit && budget.unit !== "Matriz" ? (moduleRecords["Unidades e setores"] ?? []).find(item=>item.client===budget.client&&item.name===budget.unit)?.address : customer?.address) || customer?.address || "", status:"Aberta", tone:"blue", avatar:budget.client.split(" ").map(item => item[0]).slice(0,2).join(""), catalogItems:budget.purchaseItems?.map(item => ({ id:item.productId || item.id, name:item.description, kind:item.kind || "Serviço" })) };
      const updatedOrders = [order,...serviceOrders]; const updatedModules = { ...moduleRecords, Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em OS"} : item) };
      setServiceOrders(updatedOrders); setModuleRecords(updatedModules); persistSharedState(customerRecords,updatedOrders,updatedModules); setCurrent("Ordens de serviço");
    }
    setSavedMessage(`Orçamento convertido em ${target}.`); window.setTimeout(() => setSavedMessage(""),2500);
  };
  const saveRecord = async (data: ModalSave) => {
    if (data.title.startsWith("Nova unidade, filial ou setor")) {
      const parentCustomer = data.title.split("•")[1]?.trim() || data.client;
      const structure: ModuleRecord = { id:`SET-${Date.now().toString().slice(-6)}`, name:data.name, client:parentCustomer, description:data.description || data.doc, doc:data.doc, contact:data.contact, phone:data.phone, address:data.address, category:data.category || "Setor", status:"Ativo", createdAt:new Date().toLocaleString("pt-BR"), legalName:data.legalName, tradeName:data.tradeName, email:data.email, zipCode:data.zipCode, street:data.street, addressNumber:data.addressNumber, complement:data.complement, neighborhood:data.neighborhood, city:data.city, state:data.state, stateRegistration:data.stateRegistration, municipalRegistration:data.municipalRegistration, cnaeMain:data.cnaeMain, taxStatus:data.taxStatus };
      const updatedModules = { ...moduleRecords, "Unidades e setores":[structure,...(moduleRecords["Unidades e setores"] ?? [])] };
      const updatedCustomers = customerRecords.map(customer => customer.name === parentCustomer ? {...customer,units:customer.units+1} : customer);
      setModuleRecords(updatedModules); setCustomerRecords(updatedCustomers); persistSharedState(updatedCustomers,serviceOrders,updatedModules);
      setSavedMessage(`Unidade ou setor vinculado a ${parentCustomer}.`);
    } else if (data.title === "Novo cliente") {
      const newCustomer: Customer = {
        id: `CLI-${Date.now().toString().slice(-6)}`,
        name: data.name,
        doc: data.doc,
        contact: data.contact,
        phone: data.phone,
        personType: data.personType,
        legalName: data.legalName,
        tradeName: data.tradeName,
        email: data.email,
        zipCode: data.zipCode,
        street: data.street,
        addressNumber: data.addressNumber,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        stateRegistration: data.stateRegistration,
        municipalRegistration: data.municipalRegistration,
        cnaeMain: data.cnaeMain,
        taxStatus: data.taxStatus,
        address: data.address,
        units: 0,
        status: "Ativo",
        creditLimit: data.creditLimit ?? 0,
        balancePosted: data.balancePosted ?? 0,
        financialStatus: data.financialStatus ?? "Liberado",
      };
      const updatedCustomers = [newCustomer, ...customerRecords];
      setCustomerRecords(updatedCustomers);
      localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
      persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
      setCurrent("Clientes");
      setSavedMessage(`Cliente ${newCustomer.name} cadastrado com sucesso.`);
    } else if (data.title === "Nova ordem de serviço") {
      const sequence = Math.max(15499, ...serviceOrders.map(order => Number(order.id.replace(/\D/g, "")) || 0)) + 1;
      const newOrder: ServiceOrder = {
        id: `#OS-${String(sequence).padStart(5, "0")}`,
        client: data.client,
        unit: data.unit || "Unidade principal",
        service: data.catalogItems.length ? data.catalogItems.map(item => item.name).join(", ") : data.description || "Atendimento técnico",
        tech: data.tech,
        date: data.date,
        time: data.time || "A definir",
        address: data.address,
        status: "Agendada",
        tone: "violet",
        avatar: data.client.split(" ").map(word => word[0]).slice(0, 2).join("").toUpperCase(),
        catalogItems: data.catalogItems,
        lastMaintenanceDate: data.date,
        reviewPeriodMonths: 6,
        notifyDaysBefore: 15,
      };
      const updatedOrders = [newOrder, ...serviceOrders];
      setServiceOrders(updatedOrders);
      localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(updatedOrders));
      persistSharedState(customerRecords, updatedOrders, moduleRecords);
      setCurrent("Ordens de serviço");
      setSavedMessage(`Ordem ${newOrder.id} gravada com sucesso.`);
    } else {
      const requestedModule = data.title.includes("•") ? data.title.split("•").pop()!.trim() : data.title.replace(/^Novo(a)?\s+/i, "");
      const moduleName = requestedModule === "Serviços" || requestedModule === "Produtos" ? `${data.kind}s` : requestedModule;
      const record: ModuleRecord = {
        id: `${moduleName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        name: data.name || moduleName,
        client: data.client,
        description: data.description,
        createdAt: new Date().toLocaleString("pt-BR"),
        kind: requestedModule === "Serviços" || requestedModule === "Produtos" ? data.kind : undefined,
        status: data.status,
        date: data.date,
        value: data.value,
        category: data.category,
        purchaseItems: data.purchaseItems,
        paymentType: data.paymentType,
        paymentMethod: data.paymentMethod,
        installments: data.installments,
        firstDueDate: data.firstDueDate,
        paymentInstallments: data.paymentInstallments,
        engineer: data.engineer,
        address: data.workAddress,
        blockLot: data.blockLot,
        endDate: data.endDate,
        progress: data.progress,
        commission: data.commission,
        cost: data.cost,
        doc: data.doc || undefined,
        contact: data.contact || undefined,
        phone: data.phone || undefined,
        legalName: data.legalName || undefined,
        tradeName: data.tradeName || undefined,
        email: data.email || undefined,
        zipCode: data.zipCode || undefined,
        street: data.street || undefined,
        addressNumber: data.addressNumber || undefined,
        complement: data.complement || undefined,
        neighborhood: data.neighborhood || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        stateRegistration: data.stateRegistration || undefined,
        municipalRegistration: data.municipalRegistration || undefined,
        cnaeMain: data.cnaeMain || undefined,
        taxStatus: data.taxStatus || undefined,
        sku: data.sku || undefined, barcode: data.barcode || undefined, brand: data.brand || undefined, model: data.model || undefined, supplier: data.supplier || undefined,
        stockCurrent: data.kind === "Produto" ? data.stockCurrent : undefined, stockMin: data.kind === "Produto" ? data.stockMin : undefined, stockMax: data.kind === "Produto" ? data.stockMax : undefined, stockLocation: data.kind === "Produto" ? data.stockLocation || undefined : undefined,
        warrantyMonths: data.warrantyMonths || undefined, estimatedMinutes: data.kind === "Serviço" ? data.estimatedMinutes : undefined, unitOfMeasure: data.unitOfMeasure || undefined,
        transactionType: moduleName === "Financeiro" ? (/pagar|despesa|fornecedor/i.test(`${data.name} ${data.category}`) ? "Pagar" : "Receber") : undefined,
        employeeRole: moduleName === "Funcionários" ? data.employeeRole : undefined,
        employeePermissions: moduleName === "Funcionários" ? data.employeePermissions : undefined,
        employeeUsername: moduleName === "Funcionários" ? data.employeeUsername?.trim().toLocaleLowerCase("pt-BR") : undefined,
        employeePasswordHash: moduleName === "Funcionários" && data.employeePassword ? await passwordHash(data.employeePassword) : undefined,
        equipmentType: moduleName === "Equipamentos" ? data.equipmentType : undefined,
        capacityBtus: moduleName === "Equipamentos" ? data.capacityBtus : undefined,
        serialNumber: moduleName === "Equipamentos" ? data.serialNumber : undefined,
        voltage: moduleName === "Equipamentos" ? data.voltage : undefined,
        refrigerant: moduleName === "Equipamentos" ? data.refrigerant : undefined,
        installationLocation: moduleName === "Equipamentos" ? data.installationLocation : undefined,
        installationDate: moduleName === "Equipamentos" ? data.installationDate : undefined,
        nextMaintenanceDate: moduleName === "Equipamentos" ? data.nextMaintenanceDate : undefined,
        equipmentUnit: moduleName === "Equipamentos" ? data.equipmentUnit : undefined,
      };
      let updatedRecords = { ...moduleRecords, [moduleName]: [record, ...(moduleRecords[moduleName] ?? [])] };
      if (moduleName === "Compras" && data.xmlImported) {
        const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const currentSuppliers = updatedRecords.Fornecedores ?? [];
        if (data.registerSupplier && !currentSuppliers.some(item => normalize(item.name) === normalize(data.client))) {
          const supplier: ModuleRecord = { id: `FOR-${Date.now().toString().slice(-6)}`, name: data.client, client: data.client, description: `${data.supplierDoc ? `CNPJ/CPF ${data.supplierDoc} • ` : ""}Fornecedor cadastrado automaticamente pela importação do XML`, createdAt: new Date().toLocaleString("pt-BR"), status: "Ativo", category: "Fornecedor de produtos" };
          updatedRecords = { ...updatedRecords, Fornecedores: [supplier, ...currentSuppliers] };
        }
        const currentProducts = updatedRecords.Produtos ?? [];
        const newProducts: ModuleRecord[] = [];
        data.purchaseItems.filter(item => item.registerProduct && !item.productId).forEach((item, index) => {
          const existing = [...currentProducts, ...newProducts].find(product => normalize(product.name) === normalize(item.description));
          if (existing) item.productId = existing.id;
          else {
            const product: ModuleRecord = { id: `PRO-${Date.now().toString().slice(-5)}-${index + 1}`, name: item.description, client: data.client, description: `Produto cadastrado automaticamente pela compra ${record.id}`, createdAt: new Date().toLocaleString("pt-BR"), kind: "Produto", status: "Ativo", value: item.unitValue, category: data.category || "Produto importado por XML" };
            item.productId = product.id;
            newProducts.push(product);
          }
        });
        record.purchaseItems = data.purchaseItems;
        if (newProducts.length) updatedRecords = { ...updatedRecords, Produtos: [...newProducts, ...currentProducts] };
      }
      if (moduleName === "Compras" && data.paymentType === "A prazo") {
        const baseDueDate = new Date(`${data.firstDueDate}T12:00:00`);
        const installmentCount = Math.max(1, data.paymentInstallments.length || data.installments);
        const baseInstallmentValue = Number((data.value / installmentCount).toFixed(2));
        const payables: ModuleRecord[] = Array.from({ length: installmentCount }, (_, index) => {
          const xmlInstallment = data.paymentInstallments[index];
          const dueDate = xmlInstallment?.dueDate ? new Date(`${xmlInstallment.dueDate}T12:00:00`) : new Date(baseDueDate);
          if (!xmlInstallment?.dueDate) dueDate.setMonth(baseDueDate.getMonth() + index);
          const installmentValue = xmlInstallment?.value || (index === installmentCount - 1 ? Number((data.value - baseInstallmentValue * (installmentCount - 1)).toFixed(2)) : baseInstallmentValue);
          return {
            id: `FIN-${record.id}-${String(index + 1).padStart(2, "0")}`,
            name: `Conta a pagar • ${record.name} • ${index + 1}/${installmentCount}`,
            client: data.client,
            description: `Compra ${record.id} • ${data.paymentMethod}${xmlInstallment ? " • Importado do XML" : ""}`,
            createdAt: new Date().toLocaleString("pt-BR"),
            status: "Em aberto",
            date: dueDate.toISOString().slice(0, 10),
            value: installmentValue,
            category: data.category || "Compra de produtos",
            paymentType: data.paymentType,
            paymentMethod: data.paymentMethod,
            purchaseId: record.id,
            installmentNumber: index + 1,
            installments: installmentCount,
          };
        });
        updatedRecords = { ...updatedRecords, Financeiro: [...payables, ...(moduleRecords.Financeiro ?? [])] };
      }
      setModuleRecords(updatedRecords);
      localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedRecords));
      persistSharedState(customerRecords, serviceOrders, updatedRecords);
      setCurrent(moduleName);
      setSavedMessage(moduleName === "Compras" && data.paymentType === "A prazo" ? `Compra gravada e ${Math.max(1, data.paymentInstallments.length || data.installments)} parcela(s) lançada(s) em Contas a Pagar.` : "Registro gravado com sucesso.");
    }
    setModal("");
    window.setTimeout(() => setSavedMessage(""), 3500);
  };
  const titles: Record<string,string> = { "Painel inicial": "Olá", "Clientes": "Gestão de clientes", "Obras": "Gestão de obras" };
  const subtitles: Record<string,string> = { "Painel inicial": "Uma visão completa da sua empresa em tempo real.", "Clientes": "Cadastros, unidades, histórico e relacionamento.", "Obras": "Planejamento, execução, perdas, custos e progresso em um único módulo." };
  const logout = async () => {
    try { await fetch("/api/auth", { method: "DELETE" }); } catch {}
    localStorage.removeItem("proar-offline-session");
    setAuthenticatedUser(null);
  };
  const deleteCustomer = (customer: Customer) => {
    if (!window.confirm(`Inativar o cliente “${customer.name}”? O cadastro, seus vínculos e histórico serão preservados.`)) return;
    const updatedCustomers = customerRecords.map(item => item.id === customer.id ? { ...item, status: "Inativo" } : item);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    setSavedMessage("Cliente inativado com sucesso. O histórico foi preservado.");
  };
  const deleteOrder = (order: ServiceOrder) => {
    if (!window.confirm(`Cancelar a ordem ${order.id}? A ordem continuará disponível no histórico.`)) return;
    const updatedOrders = serviceOrders.map(item => item.id === order.id ? { ...item, status: "Cancelada", tone: "red" } : item);
    setServiceOrders(updatedOrders);
    localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(updatedOrders));
    persistSharedState(customerRecords, updatedOrders, moduleRecords);
    setSelectedOrder(null);
    setSavedMessage(`Ordem ${order.id} cancelada. O histórico foi preservado.`);
  };
  const deleteModuleRecord = (moduleName: string, record: ModuleRecord) => {
    const cancellation = /Vendas|Orçamentos|Compras|Financeiro/.test(moduleName);
    if (!window.confirm(`${cancellation ? "Cancelar" : "Inativar"} o registro “${record.name}”? O histórico será mantido.`)) return;
    const updatedModules = { ...moduleRecords, [moduleName]: (moduleRecords[moduleName] ?? []).map(item => item.id === record.id ? { ...item, status: cancellation ? "Cancelado" : "Inativo" } : item) };
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(`${cancellation ? "Registro cancelado" : "Registro inativado"} com histórico preservado.`);
  };
  const updateModuleRecord = (moduleName: string, record: ModuleRecord) => {
    const currentRecords = moduleRecords[moduleName] ?? [];
    const exists = currentRecords.some(item => item.id === record.id);
    let updatedModules = { ...moduleRecords, [moduleName]: exists ? currentRecords.map(item => item.id === record.id ? record : item) : [record, ...currentRecords] };
    if (moduleName === "Compras" && record.status === "Recebida") {
      const payableId = `FIN-${record.id}`;
      const stockId = `EST-${record.id}`;
      const hasPayable = (updatedModules["Financeiro"] ?? []).some(item => item.id === payableId || item.purchaseId === record.id);
      const hasStockEntry = (updatedModules["Estoque"] ?? []).some(item => item.id === stockId);
      if (!hasPayable) updatedModules = { ...updatedModules, "Financeiro": [{ ...record, id: payableId, name: `Conta a pagar • ${record.name}`, status: "Em aberto", category: record.category || "Compra de produtos", purchaseId: record.id, createdAt: new Date().toLocaleString("pt-BR") }, ...(updatedModules["Financeiro"] ?? [])] };
      if (!hasStockEntry) updatedModules = { ...updatedModules, "Estoque": [{ ...record, id: stockId, name: `Entrada • ${record.name}`, status: "Concluído", category: "Entrada por compra", createdAt: new Date().toLocaleString("pt-BR") }, ...(updatedModules["Estoque"] ?? [])] };
    }
    updatedModules = appendAudit(updatedModules, exists ? "Registro atualizado" : "Registro criado", `${moduleName} • ${record.name}`, exists ? "Alteração registrada pelo utilizador" : "Novo cadastro registrado pelo utilizador");
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(moduleName === "Compras" && record.status === "Recebida" ? "Compra recebida: estoque e conta a pagar atualizados." : "Registro atualizado e sincronizado.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  };
  const globalSearchItems = useMemo<GlobalSearchItem[]>(() => {
    const customerItems = customerRecords.map(customer => ({ id: customer.id, title: customer.name, detail: [customer.doc, customer.phone, customer.city || customer.address].filter(Boolean).join(" • "), module: "Clientes", kind: "Cliente" as const }));
    const orderItems = serviceOrders.map(order => ({ id: order.id, title: order.id, detail: [order.client, order.service, order.tech].filter(Boolean).join(" • "), module: "Ordens de serviço", kind: "OS" as const }));
    const moduleItems = Object.entries(moduleRecords).flatMap(([module, records]) => records.map(record => ({ id: record.id, title: record.name, detail: [record.id, record.client, record.sku, record.barcode, record.serialNumber, record.doc].filter(Boolean).join(" • "), module, kind: "Cadastro" as const })));
    return [...customerItems, ...orderItems, ...moduleItems];
  }, [customerRecords, serviceOrders, moduleRecords]);
  const pendingItems = useMemo<PendingItem[]>(() => {
    const now = new Date();
    const ordersPending = serviceOrders.filter(order => /atras|aguardando|aberta|agendada/i.test(order.status)).map(order => ({ id: `os-${order.id}`, title: `${order.id} • ${order.status}`, detail: `${order.client} • ${order.date || "sem data"}`, module: "Ordens de serviço", tone: /atras/i.test(order.status) ? "red" as const : /aguardando/i.test(order.status) ? "amber" as const : "blue" as const }));
    const recordsPending = Object.entries(moduleRecords).flatMap(([module, records]) => records.filter(record => /atras|venc|aguardando|pendente|baixo estoque|sem estoque/i.test(record.status || "") || (module === "Estoque" && (record.stockCurrent ?? 0) <= (record.stockMin ?? -1))).map(record => ({ id: `${module}-${record.id}`, title: record.name, detail: `${module} • ${record.status || "Atenção necessária"}`, module, tone: /atras|venc|sem estoque/i.test(record.status || "") ? "red" as const : "amber" as const })));
    return [...ordersPending, ...recordsPending].slice(0, 20);
  }, [serviceOrders, moduleRecords]);
  const openNew = (option: string) => {
    const routes: Record<string, { module?: string; modal?: string }> = {
      "Cliente": { modal: "Novo cliente" }, "Unidade": { module: "Clientes" }, "Equipamento": { modal: "Novo • Equipamentos" }, "Orçamento": { module: "Orçamentos" }, "Venda": { module: "Vendas" }, "Ordem de Serviço": { modal: "Nova ordem de serviço" }, "Agendamento": { modal: "Nova ordem de serviço" }, "Compra": { modal: "Novo registro • Compras" }, "Produto": { modal: "Novo registro • Produtos" }, "Serviço": { modal: "Novo registro • Serviços" }, "Conta a pagar": { modal: "Novo registro • Financeiro" }, "Conta a receber": { modal: "Novo registro • Financeiro" },
    };
    const route = routes[option];
    if (route.module) setCurrent(route.module);
    if (route.modal) setModal(route.modal);
    if (option === "Unidade") setSavedMessage("Abra um cliente para cadastrar uma unidade, filial ou setor vinculado.");
  };
  const openGlobalSearch = (item: GlobalSearchItem) => {
    setCurrent(item.module);
    setSavedMessage(`${item.kind} localizado: ${item.title}.`);
  };
  const openPending = (item: PendingItem) => {
    setCurrent(item.module);
    setSavedMessage(`Pendência selecionada: ${item.title}.`);
  };
  if (checkingSession) return <div className="session-loading"><div className="brand-mark brand-logo"><img src="/icon.png" alt="ProAR"/></div><p>A carregar o ProAR...</p></div>;
  if (!authenticatedUser) return <LoginScreen onLogin={handleLogin}/>;
  return <div className="app-shell">
    <Sidebar current={current} setCurrent={setCurrent} open={menuOpen} close={() => setMenuOpen(false)} permissions={authenticatedUser.permissions}/>
    <main className="main">
      <Header title={current === "Painel inicial" ? `Olá, ${authenticatedUser.displayName.split(" ")[0]}` : titles[current] || current} subtitle={subtitles[current] || "Controle integrado da sua operação."} onMenu={() => setMenuOpen(true)} onNew={openNew} searchItems={globalSearchItems} pendingItems={pendingItems} onSearchSelect={openGlobalSearch} onPendingSelect={openPending} userName={authenticatedUser.displayName} userRole={authenticatedUser.role ?? "Utilizador"} onSwitchUser={logout} online={online} syncing={syncing} onPull={() => void pullFromDatabase()} onPush={() => void pushToDatabase()}/>
      {syncPhase !== "idle" && <div className={`sync-progress ${syncPhase}`} role="status" aria-label={syncPhase === "complete" ? "Dados atualizados" : "Sincronizando dados"}><i/></div>}
      {savedMessage && <div className="save-toast" role="status"><CheckCircle2 size={16}/>{savedMessage}</div>}
      <div className="company-context"><Building2 size={13}/><span>{activeCompany.tradeName}</span><small>{activeCompany.cnpj || "CNPJ pendente"} • {activeCompany.city}/{activeCompany.state}</small></div>
      <div className="page-content">{current === "Painel inicial" ? <Dashboard onNavigate={setCurrent} serviceOrders={serviceOrders}/> : current === "Clientes" ? <Customers onOpen={setModal} onDelete={deleteCustomer} onUpdate={updateCustomer} onUpdateStructure={record => updateModuleRecord("Unidades e setores",record)} canEdit={hasAction("Clientes","Editar")} customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} serviceOrders={serviceOrders} modules={moduleRecords}/> : current === "Agenda" ? <Agenda serviceOrders={serviceOrders} onOpen={setModal} onSelect={setSelectedOrder}/> : current === "Obras" ? <HousesWorkModule companyId={activeCompany.id} company={activeCompany} responsibleUser={authenticatedUser.displayName}/> : current === "Licitações" ? <BiddingModule/> : current === "Orçamentos" ? <BudgetPDV customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} catalog={[...(moduleRecords.Produtos ?? []),...(moduleRecords.Serviços ?? [])]} budgets={moduleRecords.Orçamentos ?? []} onSave={record => updateModuleRecord("Orçamentos",record)} onConvert={convertBudget} onDelete={record => deleteModuleRecord("Orçamentos",record)}/> : current === "Vendas" ? <SalesPDV customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} records={[...(moduleRecords.Produtos ?? []),...(moduleRecords.Serviços ?? [])]} sales={moduleRecords.Vendas ?? []} onSave={record => updateModuleRecord("Vendas",record)}/> : current === "Relatórios" ? <Reports modules={moduleRecords} customers={customerRecords} serviceOrders={serviceOrders} company={activeCompany}/> : current === "Configurações" ? <SettingsModule companies={companies} activeCompany={activeCompany} onCompaniesChange={updateCompanies} onSelectCompany={selectCompany}/> : current === "Financeiro" ? <FinancialModule records={moduleRecords.Financeiro ?? []} onOpen={setModal} onUpdate={updateModuleRecord}/> : current === "Ordens de serviço" ? <ServiceOrders onOpen={setModal} onSelect={setSelectedOrder} onDelete={deleteOrder} onUpdate={updateServiceOrder} serviceOrders={serviceOrders} customers={customerRecords} company={activeCompany}/> : <GenericModule name={current} onOpen={setModal} onDelete={deleteModuleRecord} onUpdate={updateModuleRecord} onConvert={convertBudget} companyCnpj={activeCompany.cnpj} canEdit={hasAction(current,"Editar")} records={moduleRecords[current] ?? []} allModules={moduleRecords} serviceOrders={serviceOrders}/>}</div>
      <footer><span>© 2026 ProAR Gestão de Serviços</span><span><ShieldCheck size={12}/> Gestão segura e inteligente para prestadores de serviços.</span></footer>
    </main>
    {modal && <Modal title={modal} customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} catalogRecords={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} supplierRecords={moduleRecords["Fornecedores"] ?? []} employeeRecords={moduleRecords["Funcionários"] ?? [tiagoEmployee]} close={() => setModal("")} onSave={saveRecord}/>}
    {selectedOrder && <OrderDetail order={selectedOrder} customerPhone={customerRecords.find(customer => customer.name === selectedOrder.client)?.phone} company={activeCompany} catalog={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} close={() => setSelectedOrder(null)} onUpdate={updateServiceOrder} canEdit={hasAction("Ordens de serviço","Editar")}/>}{/* detalhe da OS */}
  </div>;
}
