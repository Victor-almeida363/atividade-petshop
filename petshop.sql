CREATE DATABASE IF NOT EXISTS petshop
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE petshop;

CREATE TABLE IF NOT EXISTS cliente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    telefone VARCHAR(20) NOT NULL,
    endereco VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS animal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    especie VARCHAR(50) NOT NULL,
    raca VARCHAR(80),
    data_nascimento DATE,
    cliente_id INT NOT NULL,
    CONSTRAINT fk_animal_cliente FOREIGN KEY (cliente_id)
      REFERENCES cliente(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS servico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    duracao INT NOT NULL COMMENT 'Duração em minutos'
);

CREATE TABLE IF NOT EXISTS agendamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_hora DATETIME NOT NULL,
    istatus VARCHAR(30) NOT NULL DEFAULT 'Agendado',
    observacao TEXT,
    leva_traz BOOLEAN NOT NULL DEFAULT FALSE,
    animal_id INT NOT NULL,
    servico_id INT NOT NULL,
    CONSTRAINT fk_agendamento_animal FOREIGN KEY (animal_id)
      REFERENCES animal(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_agendamento_servico FOREIGN KEY (servico_id)
      REFERENCES servico(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_agendamento_horario UNIQUE (data_hora)
);

CREATE TABLE IF NOT EXISTS pagamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    valor DECIMAL(10,2) NOT NULL,
    forma_pagamento VARCHAR(30) NOT NULL,
    data_pagamento DATETIME,
    agendamento_id INT NOT NULL UNIQUE,
    CONSTRAINT fk_pagamento_agendamento FOREIGN KEY (agendamento_id)
      REFERENCES agendamento(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

INSERT IGNORE INTO cliente (nome, cpf, telefone, endereco) VALUES
('Maria Silva', '111.111.111-11', '(67) 99911-1111', 'Rua das Flores, 100'),
('Joao Santos', '222.222.222-22', '(67) 99922-2222', 'Rua Brasil, 200'),
('Ana Oliveira', '333.333.333-33', '(67) 99933-3333', 'Rua das Palmeiras, 300');

INSERT INTO animal (nome, especie, raca, data_nascimento, cliente_id)
SELECT 'Rex', 'Cachorro', 'Labrador', '2021-05-10', c.id FROM cliente c WHERE c.cpf='111.111.111-11'
AND NOT EXISTS (SELECT 1 FROM animal WHERE nome='Rex' AND cliente_id=c.id);
INSERT INTO animal (nome, especie, raca, data_nascimento, cliente_id)
SELECT 'Luna', 'Gato', 'Siamês', '2022-08-15', c.id FROM cliente c WHERE c.cpf='111.111.111-11'
AND NOT EXISTS (SELECT 1 FROM animal WHERE nome='Luna' AND cliente_id=c.id);
INSERT INTO animal (nome, especie, raca, data_nascimento, cliente_id)
SELECT 'Thor', 'Cachorro', 'Poodle', '2020-03-20', c.id FROM cliente c WHERE c.cpf='222.222.222-22'
AND NOT EXISTS (SELECT 1 FROM animal WHERE nome='Thor' AND cliente_id=c.id);
INSERT INTO animal (nome, especie, raca, data_nascimento, cliente_id)
SELECT 'Mel', 'Gato', 'Persa', '2023-01-12', c.id FROM cliente c WHERE c.cpf='333.333.333-33'
AND NOT EXISTS (SELECT 1 FROM animal WHERE nome='Mel' AND cliente_id=c.id);

INSERT INTO servico (nome, preco, duracao)
SELECT 'Banho', 50.00, 40 WHERE NOT EXISTS (SELECT 1 FROM servico WHERE nome='Banho');
INSERT INTO servico (nome, preco, duracao)
SELECT 'Tosa', 70.00, 60 WHERE NOT EXISTS (SELECT 1 FROM servico WHERE nome='Tosa');
INSERT INTO servico (nome, preco, duracao)
SELECT 'Consulta veterinária', 120.00, 30 WHERE NOT EXISTS (SELECT 1 FROM servico WHERE nome='Consulta veterinária');

-- Consulte os dados após importar o arquivo.
SELECT * FROM cliente;
SELECT * FROM animal;
SELECT * FROM servico;
SELECT * FROM agendamento;
SELECT * FROM pagamento;