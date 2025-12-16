const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Configuração Supabase via variáveis de ambiente
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("SUPABASE_URL ou SUPABASE_ANON_KEY não configurados!");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ==================== ROTA API PARA BUSCAR PEDIDO ====================
app.get("/api/orders/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, client_lat, client_lng, client_address, status, tracking_link")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar pedido:", error);
      return res.status(500).json({ error: "Erro ao buscar pedido no banco de dados" });
    }

    if (!data) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    return res.json(data);
  } catch (err) {
    console.error("Erro interno do servidor:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});
// =====================================================================

// ==================== SOCKET.IO PARA RASTREAMENTO EM TEMPO REAL ====================
io.on("connection", (socket) => {
  console.log("Novo cliente conectado:", socket.id);

  // Motorista ou cliente entra na sala do pedido
  socket.on("joinOrderRoom", ({ orderId }) => {
    if (!orderId) return;
    socket.join(orderId);
    console.log(`Socket ${socket.id} entrou na sala do pedido ${orderId}`);
  });

  // Motorista envia atualização de localização
  socket.on("updateLocation", (data) => {
    const { orderId, latitude, longitude } = data || {};
    if (!orderId || latitude == null || longitude == null) return;

    console.log(`Atualizando localização do pedido ${orderId}:`, { latitude, longitude });
    
    // Envia para todos na sala do pedido (incluindo o cliente)
    io.to(orderId).emit("locationUpdate", { latitude, longitude });
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});
// ====================================================================================

// Rota de teste
app.get("/ping", (req, res) => {
  res.send("pong");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
});