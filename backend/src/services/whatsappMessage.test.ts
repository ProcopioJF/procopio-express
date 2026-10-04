import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildNewOrderWhatsAppMessage,
  buildNewOrderWhatsAppTemplateParameters,
} from "./whatsappMessage.js"

const pickupAddress = {
  rua: "Rua da Coleta",
  numero: "10",
  complemento: "Sala 2",
  bairro: "Centro",
  cidade: "Juiz de Fora",
  estado: "MG",
  cep: "36000-000",
}

const deliveryAddress = {
  rua: "Rua da Entrega",
  numero: "25",
  complemento: "Casa B",
  bairro: "Cascatinha",
  cidade: "Juiz de Fora",
  estado: "MG",
  cep: "36000-001",
}

describe("buildNewOrderWhatsAppMessage", () => {
  it("identifies the company and delivery recipient for company orders", () => {
    const message = buildNewOrderWhatsAppMessage({
      publicId: "pedido-empresa",
      companyId: "company-1",
      company: { name: "Acme Logística" },
      requesterName: "Operador Interno",
      requesterPhone: "32999990000",
      pickupAddress,
      recipientName: "Maria Silva",
      recipientPhone: "32988887777",
      deliveryAddress,
    })

    assert.match(message, /EMPRESA: Acme Logística/)
    assert.match(message, /Recebedor: Maria Silva/)
    assert.match(message, /Telefone: 32988887777/)
    assert.match(message, /Rua da Entrega, 25, Casa B, Cascatinha - Juiz de Fora - MG, CEP 36000-001/)
    assert.doesNotMatch(message, /Operador Interno|Rua da Coleta|32999990000/)
  })

  it("identifies the requester, pickup, and delivery for ad-hoc orders", () => {
    const message = buildNewOrderWhatsAppMessage({
      publicId: "pedido-avulso",
      companyId: null,
      company: null,
      requesterName: "João Souza",
      requesterPhone: "32977776666",
      pickupAddress,
      recipientName: "Ana Lima",
      recipientPhone: "32966665555",
      deliveryAddress,
    })

    assert.match(message, /Solicitante: João Souza/)
    assert.match(message, /Telefone: 32977776666/)
    assert.match(message, /Coleta: Rua da Coleta, 10, Sala 2, Centro - Juiz de Fora - MG, CEP 36000-000/)
    assert.match(message, /Recebedor: Ana Lima/)
    assert.match(message, /Telefone: 32966665555/)
    assert.match(message, /Rua da Entrega, 25, Casa B, Cascatinha - Juiz de Fora - MG, CEP 36000-001/)
  })

  it("maps company order details to the approved template parameters", () => {
    assert.deepEqual(
      buildNewOrderWhatsAppTemplateParameters({
        publicId: "pedido-empresa",
        companyId: "company-1",
        company: { name: "Acme Logística" },
        requesterName: "Operador Interno",
        requesterPhone: "32999990000",
        pickupAddress,
        recipientName: "Maria Silva",
        recipientPhone: "32988887777",
        deliveryAddress,
      }),
      [
        "pedido-empresa",
        "Empresa: Acme Logística",
        "Maria Silva",
        "Rua da Entrega, 25, Casa B, Cascatinha - Juiz de Fora - MG, CEP 36000-001",
        "32988887777",
      ],
    )
  })

  it("maps requester and pickup details to the approved template parameters", () => {
    assert.deepEqual(
      buildNewOrderWhatsAppTemplateParameters({
        publicId: "pedido-avulso",
        companyId: null,
        company: null,
        requesterName: "João Souza",
        requesterPhone: "32977776666",
        pickupAddress,
        recipientName: "Ana Lima",
        recipientPhone: "32966665555",
        deliveryAddress,
      }),
      [
        "pedido-avulso",
        "Solicitante: João Souza\nTelefone: 32977776666\nColeta: Rua da Coleta, 10, Sala 2, Centro - Juiz de Fora - MG, CEP 36000-000",
        "Ana Lima",
        "Rua da Entrega, 25, Casa B, Cascatinha - Juiz de Fora - MG, CEP 36000-001",
        "32966665555",
      ],
    )
  })
})
