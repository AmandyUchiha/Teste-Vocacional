import { useState, useEffect } from 'react';
import { supabase } from './main.jsx';
import './App.css';

function App() {
  // Estados Principais
  const [userId, setUserId] = useState(null);
  const [userNickname, setUserNickname] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [pastResults, setPastResults] = useState([]);
  const [view, setView] = useState('register'); // 'register', 'quiz', 'result', 'history'

  // Estados de Carga e Erro
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registrationError, setRegistrationError] = useState(null); 

  // Efeito para carregar as questões e histórico
  useEffect(() => {
    async function getQuestionsAndOptions() {
      const { data, error } = await supabase
        .from('questoes')
        .select(`
          id_q,
          enunciado,
          opcoes(id_o, opcao)
        `);

      if (error) {
        console.error('Erro ao carregar os dados:', error);
        setError('Erro ao carregar os dados do teste.');
      } else {
        setQuestions(data);
      }
      setLoading(false);
    }
    getQuestionsAndOptions();
    
    const savedResults = localStorage.getItem('testHistory');
    if (savedResults) {
      setPastResults(JSON.parse(savedResults));
    }
  }, []);


  // Cadastra o usuário e inicia o teste
  async function handleRegister(e) {
    e.preventDefault();
    setRegistrationError(null); 

    const { data, error } = await supabase
      .from('usuarios')
      .insert({ apelido: userNickname })
      .select();

    if (error) {
      console.error('Erro ao cadastrar usuário:', error);
      if (error.code === '23505') {
        setRegistrationError('Apelido já em uso. Por favor, escolha outro.');
      } else {
        setError('Erro ao cadastrar usuário. Tente novamente.');
      }
    } else {
      setUserId(data[0].id_u);
      setCurrentQuestionIndex(0);
      setView('quiz');
    }
  }

  // Lida com a seleção de uma resposta e avança ou finaliza
  function handleAnswer(questionId, optionId) {
    const filteredAnswers = userAnswers.filter((answer) => answer.id_q !== questionId);
    const newAnswers = [...filteredAnswers, { id_u: userId, id_q: questionId, id_o: optionId }];
    setUserAnswers(newAnswers);

    if (currentQuestionIndex === questions.length - 1) {
      handleSubmitTest(newAnswers);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }

  // Volta para a pergunta anterior
  function handleBack() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }

  // Limpa todos os estados e volta para a tela de registro
  function handleGoToRegister() {
    setUserId(null);
    setUserNickname('');
    setUserAnswers([]);
    setCurrentQuestionIndex(0);
    setFinalResult(null);
    setView('register');
  }

  // Função para reiniciar o teste (volta para a tela de apelido)
  function handleRestartTest() {
    handleGoToRegister();
  }

  // Salva o resultado no histórico local
  function handleSaveResult(result) {
    const newHistory = [...pastResults, result];
    setPastResults(newHistory);
    localStorage.setItem('testHistory', JSON.stringify(newHistory));
  }

  // Limpa todo o histórico local
  function handleClearHistory() {
    setPastResults([]);
    localStorage.removeItem('testHistory');
  }

  // Envia as respostas, calcula e exibe o resultado
  async function handleSubmitTest(answers) {
    setLoading(true);

    // 1. Salvar Respostas
    const { error: answersError } = await supabase
      .from('respostas_usuario')
      .insert(answers);

    if (answersError) {
      console.error('Erro ao salvar respostas:', answersError);
      setError('Erro ao salvar suas respostas.');
      setLoading(false);
      return;
    }

    // 2. Calcular Resultados
    const { data: resultsData, error: resultsError } = await supabase
      .from('respostas_usuario')
      .select(`
        opcoes(
          pontuacao(area, valor)
        )
      `)
      .eq('id_u', userId);

    if (resultsError) {
      console.error('Erro ao calcular resultados:', resultsError);
      setError('Erro ao calcular o resultado.');
      setLoading(false);
      return;
    }

    // Lógica de pontuação (mantida do código original)
    const scoreMap = {};
    resultsData.forEach(item => {
      const pontuacoes = item.opcoes.pontuacao;
      if (pontuacoes && pontuacoes.length > 0) {
        pontuacoes.forEach(p => {
          const area = p.area;
          const valor = p.valor;
          scoreMap[area] = (scoreMap[area] || 0) + valor;
        });
      }
    });

    const areas = Object.entries(scoreMap);
    areas.sort((a, b) => b[1] - a[1]);

    const areaMapping = {
      'Áreas Técnicas e Científicas': ['Engenharia', 'Tecnologia da Informação', 'Física', 'Matemática'],
      'Áreas Criativas': ['Design', 'Artes', 'Comunicação', 'Moda', 'Publicidade'],
      'Áreas de Saúde e Bem-Estar': ['Medicina', 'Psicologia', 'Terapias', 'Enfermagem'],
      'Áreas de Administração e Negócios': ['Gestão', 'Administração', 'Marketing', 'Finanças'],
      'Áreas Humanas e Sociais': ['Educação', 'Trabalho Social', 'Recursos Humanos', 'Direito'],
      'Áreas de Comunicação e Mídia': ['Jornalismo', 'Produção de Conteúdo', 'Relações Públicas']
    };

    let finalArea = "N/A";
    let suggestions = [];

    if (areas.length > 0) {
      const principalArea = areas[0];
      finalArea = principalArea[0];
      suggestions = areaMapping[finalArea] || [];
    }

    const currentResult = {
      nickname: userNickname,
      date: new Date().toLocaleDateString('pt-BR'),
      area: finalArea,
      sugestoes: suggestions
    };

    // 3. Salvar Resultado Final (no banco)
    const { error: saveError } = await supabase
      .from('resultado')
      .insert({
        id_u: userId,
        area_principal: finalArea,
        percentual_principal: areas[0][1]
      });

    if (saveError) {
      console.error('Erro ao salvar o resultado final:', saveError.message); 
      setError('Erro ao salvar o resultado final.');
    } else {
      setFinalResult(currentResult);
      handleSaveResult(currentResult); 
      setView('result');
    }
    setLoading(false);
  }

  // Renderização Condicional (Views)

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  switch (view) {
    case 'register':
      return (
        <div className="app-container">
          <h1>Teste Vocacional</h1>
          <form onSubmit={handleRegister} className="register-form">
            <p>Qual seu apelido?</p>
            <input
              type="text"
              value={userNickname}
              onChange={(e) => setUserNickname(e.target.value)}
              placeholder="Seu apelido aqui"
              required
            />
            <button type="submit">Começar o Teste</button>
          </form>
          {registrationError && <div className="error-message"><p>{registrationError}</p></div>}
        </div>
      );

    case 'quiz':
      const currentQuestion = questions[currentQuestionIndex];
      return (
        <div className="app-container">
          <h1>Teste Vocacional</h1>
          <p className="question-text">
            Questão {currentQuestionIndex + 1} de {questions.length}
          </p>
          <div className="question-item">
            <p className="question-enunciado">{currentQuestion.enunciado}</p>
            <div className="options-container">
              {currentQuestion.opcoes.map(o => (
                <button
                  key={o.id_o}
                  className="option-button"
                  onClick={() => handleAnswer(currentQuestion.id_q, o.id_o)}>
                  {o.opcao}
                </button>
              ))}
            </div>
          </div>
          {currentQuestionIndex > 0 && (
            <button onClick={handleBack} className="back-button">Voltar</button>
          )}
          {/* REMOVIDO: <button onClick={handleGoToRegister} className="go-to-register-button">Voltar para Registro</button> */}
          {/* Botão para reiniciar o teste na tela de questões */}
          <button onClick={handleRestartTest} className="restart-button">
            Reiniciar Teste
          </button>
        </div>
      );

    case 'result':
      return (
        <div className="app-container">
          <h1>Seu Resultado</h1>
          <p className="result-text">Olá, {userNickname}! Sua área principal de interesse é:</p>
          <div className="main-result">
            <p className="result-area-principal">{finalResult.area}</p>
          </div>
          {finalResult.sugestoes.length > 0 && (
            <div className="suggestions">
              <h2>Alguns caminhos possíveis:</h2>
              <ul>
                {finalResult.sugestoes.map((sugestao, index) => (
                  <li key={index}>{sugestao}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => setView('history')} className="history-button">
            Ver Histórico
          </button>
          {/* Botão de reiniciar o teste no resultado (agora volta para registro) */}
          <button onClick={handleRestartTest} className="restart-button">
            Reiniciar Teste
          </button>
        </div>
      );

    case 'history':
      return (
        <div className="app-container">
          <h1>Histórico de Testes</h1>
          {pastResults.length > 0 ? (
            <>
              <ul>
                {pastResults.map((result, index) => (
                  <li key={index}>
                    **Apelido**: {result.nickname} - **Data**: {result.date} - **Área Principal**: {result.area}
                  </li>
                ))}
              </ul>
              <button onClick={handleClearHistory} className="clear-history-button">
                Limpar Histórico
              </button>
            </>
          ) : (
            <p>Nenhum resultado anterior encontrado.</p>
          )}
          <button onClick={() => setView('register')} className="back-to-test-button">
            Voltar para Registro
          </button>
        </div>
      );

    default:
      return null;
  }
}

export default App;