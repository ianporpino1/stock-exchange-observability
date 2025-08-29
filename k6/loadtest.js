import http from "k6/http";
import { check, sleep, fail } from "k6";
import { SharedArray } from "k6/data";

export const options = {
  vus: 10,
  duration: "1m",
};

const baseUrl = "http://host.docker.internal:8080";
const symbols = new SharedArray("symbols", () => ["AAPL", "GOOGL", "MSFT"]);

function createRandomUserPayload() {
  const id = Math.floor(Math.random() * 1000000);
  return {
    username: `user_${id}`,
    password: "senha123",
  };
}

export function setup() {
  const users = [];

  console.log(`Iniciando setup para ${options.vus} VUs...`);

  for (let i = 0; i < options.vus; i++) {
    const userPayload = createRandomUserPayload();

    const createUserRes = http.post(
      `${baseUrl}/user-service/users`,
      JSON.stringify(userPayload),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    check(createUserRes, {
      "usuário criado ou já existente": (r) =>
        r.status === 201 || r.status === 409,
    });

    const loginRes = http.post(
      `${baseUrl}/user-service/auth/login`,
      JSON.stringify(userPayload),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (
      !check(loginRes, { "login bem-sucedido": (r) => r.status === 200 })
    ) {
      fail(`Login falhou para o usuário ${userPayload.username}. Abortando o teste.`);
    }

    const token = loginRes.json().accessToken;
    if (!token) {
        fail("Não foi possível extrair o token da resposta de login.");
    }
    
    users.push({ token: token });
    console.log(`Usuário ${i + 1} configurado com sucesso.`);
  }
  
  console.log("Setup concluído com sucesso!");
  return { users: users };
}

export default function (data) {
  const vuIndex = __VU - 1;
  const token = data.users[vuIndex].token;
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];

//   const lastPriceRes = http.get(`${baseUrl}/last-price/${symbol}`, {
//     headers: { Authorization: `Bearer ${token}` },
//   });

  let lastPrice = 50;
//   if (lastPriceRes.status === 200 && lastPriceRes.json().price) {
//     lastPrice = lastPriceRes.json().price;
//   }
//   check(lastPriceRes, {
//   "last-price ok ou não existente": (r) => r.status === 200 || r.status === 404,
// });


  const variation = Math.random() * 0.1 - 0.05;
  const price = parseFloat((lastPrice * (1 + variation)).toFixed(2));

  const orderPayload = {
    symbol: symbol,
    orderType: Math.random() > 0.5 ? "BUY" : "SELL",
    quantity: Math.floor(Math.random() * 50) + 1,
    price: price,
  };

  const orderRes = http.post(
    `${baseUrl}/order-service/orders`,
    JSON.stringify(orderPayload),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (orderRes.status !== 201 && orderRes.status !== 200) {
    console.error(
      `[VU: ${__VU}] Falha ao enviar ordem. Status: ${orderRes.status}, Body: ${orderRes.body}`
    );
  }

  check(orderRes, {
    "ordem criada com sucesso": (r) => r.status === 201 || r.status === 200,
  });
    // sleep(1);
}