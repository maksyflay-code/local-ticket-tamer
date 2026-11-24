import { describe, expect, it } from "vitest";
import { validarMateriais } from "./estoque";

describe("materiais utilizados na OS", () => {
  it("baixa 2 caixas de um saldo de 18", () => {
    expect(validarMateriais([{ item_id: "caixa", quantidade: 2 }], new Map([["caixa", 18]]))).toBeNull();
  });
  it("não permite consumir 19 caixas de um saldo de 18", () => {
    expect(validarMateriais([{ item_id: "caixa", quantidade: 19 }], new Map([["caixa", 18]]))).not.toBeNull();
  });
  it("soma linhas repetidas antes de conferir o saldo", () => {
    expect(validarMateriais([{ item_id: "caixa", quantidade: 10 }, { item_id: "caixa", quantidade: 9 }], new Map([["caixa", 18]]))).not.toBeNull();
  });
  it("não aceita quantidades fracionadas", () => {
    expect(validarMateriais([{ item_id: "caixa", quantidade: 1.5 }], new Map([["caixa", 18]]))).not.toBeNull();
  });
});