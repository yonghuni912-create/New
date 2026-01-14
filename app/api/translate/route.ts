import { NextRequest, NextResponse } from 'next/server';

// ============================================
// 1단계: 용어집 기반 치환 (한글 → 영어)
// ============================================

// 동사 매핑 (verb_lexicon 시트에서 추출)
const VERB_MAPPINGS: Record<string, string> = {
  // 추가/넣다
  '추가하다': 'add', '추가한다': 'add', '추가해준다': 'add', '추가해 준다': 'add',
  '넣다': 'put', '넣는다': 'put', '넣어준다': 'put', '넣어 준다': 'put',
  '담다': 'put', '담는다': 'put', '담아준다': 'put', '담아 준다': 'put',
  
  // 섞다/혼합
  '섞다': 'mix', '섞는다': 'mix', '섞어준다': 'mix', '섞어 준다': 'mix',
  '잘 섞는다': 'mix well', '잘섞는다': 'mix well', '잘 섞어준다': 'mix well',
  '골고루 섞는다': 'mix evenly', '골고루섞는다': 'mix evenly', '골고루 섞어준다': 'mix evenly',
  '혼합하다': 'mix', '혼합한다': 'mix', '혼합해준다': 'mix', '혼합해 준다': 'mix',
  '버무리다': 'toss', '버무린다': 'toss', '버무려준다': 'toss',
  '저어주다': 'stir', '저어준다': 'stir', '저어 준다': 'stir',
  '풀다': 'dissolve', '푼다': 'dissolve', '풀어준다': 'dissolve',
  
  // 조리
  '튀기다': 'fry', '튀긴다': 'fry', '튀겨준다': 'fry', '튀겨 준다': 'fry',
  '바삭하게 튀긴다': 'fry until crispy', '바삭하게튀긴다': 'fry until crispy',
  '굽다': 'bake', '굽는다': 'bake', '구워준다': 'bake', '구워 준다': 'bake',
  '볶다': 'saute', '볶는다': 'saute', '볶아준다': 'saute', '볶아 준다': 'saute',
  '끓이다': 'boil', '끓인다': 'boil', '끓여준다': 'boil', '끓여 준다': 'boil',
  '가열하다': 'heat', '가열한다': 'heat', '가열해준다': 'heat', '가열해 준다': 'heat',
  '데우다': 'heat', '데운다': 'heat', '데워준다': 'heat', '데워 준다': 'heat',
  '조리하다': 'cook', '조리한다': 'cook', '조리해준다': 'cook', '조리해 준다': 'cook',
  
  // 자르기/썰기
  '자르다': 'cut', '자른다': 'cut', '잘라준다': 'cut', '잘라 준다': 'cut',
  '썰다': 'slice', '썬다': 'slice', '썰어준다': 'slice', '썰어 준다': 'slice',
  '잘게 썰다': 'finely chop', '잘게 썬다': 'finely chop', '잘게 썰어준다': 'finely chop',
  '다지다': 'mince', '다진다': 'mince', '다져준다': 'mince',
  '채썰다': 'julienne', '채썬다': 'julienne',
  
  // 붓다/뿌리다
  '붓다': 'pour', '붓는다': 'pour', '부어준다': 'pour', '부어 준다': 'pour',
  '뿌리다': 'sprinkle', '뿌린다': 'sprinkle', '뿌려준다': 'sprinkle', '뿌려 준다': 'sprinkle',
  
  // 서빙/제공
  '서빙하다': 'serve', '서빙한다': 'serve', '서빙해준다': 'serve', '서빙해 준다': 'serve',
  '제공하다': 'serve', '제공한다': 'serve', '제공해준다': 'serve', '제공해 준다': 'serve',
  '플레이팅': 'plate',
  
  // 보관
  '보관하다': 'store', '보관한다': 'store', '보관해준다': 'store', '보관해 준다': 'store',
  '냉장 보관하다': 'refrigerate', '냉장 보관한다': 'refrigerate', '냉장보관하다': 'refrigerate',
  '냉동 보관하다': 'freeze', '냉동 보관한다': 'freeze', '냉동보관하다': 'freeze',
  
  // 기타
  '재우다': 'marinate', '재운다': 'marinate', '재워준다': 'marinate',
  '마리네이트하다': 'marinate', '염지하다': 'brine', '염지한다': 'brine',
  '올리다': 'garnish', '올린다': 'garnish', '올려준다': 'garnish', '올려 준다': 'garnish',
  '배치하다': 'place', '배치한다': 'place', '올려놓다': 'place', '올려놓는다': 'place',
  '준비하다': 'prepare', '준비한다': 'prepare',
  '해동하다': 'thaw', '해동한다': 'thaw', '녹이다': 'thaw',
};

// 식재료 매핑 (Pricing 템플릿에서 추출)
const INGREDIENT_MAPPINGS: Record<string, string> = {
  // 닭고기
  '닭다리살': 'boneless chicken thigh', '닭가슴살': 'chicken breast',
  '닭윙': 'chicken wing', '닭날개': 'chicken wing', '치킨': 'chicken',
  '닭': 'chicken', '닭고기': 'chicken',
  
  // 채소
  '파': 'green onion', '대파': 'green onion', '쪽파': 'green onion',
  '양파': 'onion', '다진 양파': 'chopped onion', '양파 다진것': 'chopped onion',
  '마늘': 'garlic', '다진 마늘': 'minced garlic',
  '생강': 'ginger', '고추': 'chili pepper', '할라피뇨': 'jalapeño',
  '파프리카': 'bell pepper', '피망': 'bell pepper',
  '당근': 'carrot', '옥수수': 'corn', '양배추': 'cabbage',
  
  // 조미료/소스
  '소금': 'salt', '설탕': 'sugar', '후추': 'pepper', '간장': 'soy sauce',
  '식초': 'vinegar', '겨자': 'mustard', '마요네즈': 'mayonnaise',
  '사워크림': 'sour cream', '꿀': 'honey',
  
  // 파우더/믹스
  '마리네이드 파우더': 'marinade powder', '마리네이드 믹스': 'marinade mix',
  '시즈닝 파우더': 'seasoning powder', '튀김가루': 'battering powder mix',
  '배터링 파우더': 'battering powder', '배터믹스': 'batter mix',
  
  // 유제품
  '버터': 'butter', '치즈': 'cheese', '우유': 'milk', '크림': 'cream',
  
  // 기타
  '물': 'water', '얼음물': 'ice water', '기름': 'oil', '식용유': 'cooking oil',
  '올리브유': 'olive oil', '참기름': 'sesame oil',
  '깨': 'sesame seeds', '참깨': 'sesame seeds',
};

// 단위 매핑
const UNIT_MAPPINGS: Record<string, string> = {
  '그램': 'g', '킬로그램': 'kg', '밀리리터': 'ml', '리터': 'L',
  // 시간 단위 (숫자 뒤에만 적용되도록 주의)
  '시간': 'hours', '초': 'seconds',
  '개': 'pcs', '조각': 'pieces', '인분': 'servings',
};

// 기타 표현 매핑
const PHRASE_MAPPINGS: Record<string, string> = {
  // 부사/형용사
  '골고루': 'evenly', '잘': 'well', '충분히': 'thoroughly',
  '완전히': 'completely', '바삭하게': 'until crispy',
  '가볍게': 'lightly', '작은': 'small', '약': 'approximately',
  '최대': 'maximum', '모든': 'all', '여분의': 'excess',
  
  // 조리 온도/불
  '중불': 'medium heat', '강불': 'high heat', '약불': 'low heat',
  '온도': 'temperature',
  
  // 장소/용기
  '냉장고': 'refrigerator', '냉동고': 'freezer',
  '상온': 'room temperature', '지정 용기': 'designated container',
  '스테인리스 볼': 'stainless steel bowl', 
  '스테인리스 용기': 'stainless steel container',
  '믹싱볼': 'mixing bowl', '프라이어': 'fryer',
  '용기': 'container', '볼': 'bowl',
  
  // 시간 표현
  '시간 동안': 'for hours', '분 동안': 'for minutes', '분간': 'for minutes',
  '후에는': 'after', '후': 'after',
  
  // 비율/측정
  '비율로': 'at ratio', '비율': 'ratio',
  '이상': 'or more', '이하': 'or less',
  
  // 상태/조건
  '상태': 'condition', '신선도': 'freshness',
  '끝부분': 'end part', '부분': 'part',
  
  // 서빙/고객
  '고객에게': 'to customer', '손님에게': 'to customer',
  '함께': 'with', '제공': 'serve',
  
  // 기타
  '모든 재료': 'all ingredients', '조리': 'cooking',
  '시작하기 전에': 'before starting', '과정': 'process',
  '솔루션': 'solution', '믹스': 'mix', '파우더': 'powder',
  '핏물': 'blood', '기름': 'oil', '가루': 'powder',
  '피클 무': 'pickled radish', '칼집': 'cut', '작은 칼집': 'small cut',
};

// 1단계: 용어집 기반 치환 함수
function applyTerminologyMapping(text: string): string {
  let result = text;
  
  // 먼저 숫자+분 패턴을 특수 처리 (예: "11분" → "11 minutes")
  result = result.replace(/(\d+)\s*분(?!\w)/g, '$1 minutes');
  
  // 긴 표현부터 먼저 치환 (더 구체적인 표현 우선)
  const allMappings = {
    ...PHRASE_MAPPINGS,
    ...VERB_MAPPINGS,
    ...INGREDIENT_MAPPINGS,
    ...UNIT_MAPPINGS,
  };
  
  // 긴 키부터 정렬하여 치환
  const sortedKeys = Object.keys(allMappings).sort((a, b) => b.length - a.length);
  
  for (const korean of sortedKeys) {
    const english = allMappings[korean];
    // 정규식 이스케이프
    const escaped = korean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), english);
  }
  
  return result;
}

// ============================================
// 1.5단계: 문법 규칙 적용 (조사 제거 + 어순 조정)
// ============================================

function applyGrammarRules(text: string): string {
  let result = text;
  
  // 1. 한국어 조사 제거
  const particles = [
    '을를', '을', '를', '이가', '이', '가', '은는', '은', '는',
    '에서', '에게', '에', '으로', '로', '와', '과', '의', '도',
    '까지', '부터', '만', '마다', '조차', '밖에', '께서', '에게서',
    '한테', '더러', '보고', '하고'
  ];
  
  // 긴 조사부터 제거
  particles.sort((a, b) => b.length - a.length);
  for (const particle of particles) {
    const regex = new RegExp(particle + '(?=\\s|$)', 'g');
    result = result.replace(regex, '');
  }
  
  // 2. 연속 공백 제거
  result = result.replace(/\s+/g, ' ').trim();
  
  // 3. 영어 동사 찾기 (일반적인 조리 동작)
  const commonVerbs = [
    'add', 'put', 'mix', 'fry', 'bake', 'saute', 'boil', 'heat',
    'cut', 'slice', 'chop', 'mince', 'julienne', 'pour', 'sprinkle',
    'serve', 'store', 'marinate', 'garnish', 'place', 'prepare', 'thaw',
    'cook', 'stir', 'dissolve', 'toss', 'brine', 'refrigerate', 'freeze'
  ];
  
  // 4. 문장 재구성 (동사를 찾아서 앞으로)
  const words = result.split(' ');
  let verbIndex = -1;
  let verb = '';
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (commonVerbs.includes(word)) {
      verbIndex = i;
      verb = words[i];
      break;
    }
  }
  
  if (verbIndex > 0) {
    // 동사를 문장 앞으로 이동
    const beforeVerb = words.slice(0, verbIndex);
    const afterVerb = words.slice(verbIndex + 1);
    
    // "동사 + 나머지" 형태로 재구성
    result = [verb, ...beforeVerb, ...afterVerb].join(' ');
  }
  
  // 5. 특수 패턴 정리
  // "A B until C" -> "A B until C"는 그대로
  // "until crispy fry" -> "fry until crispy"
  result = result.replace(/until\s+(\w+)\s+(fry|bake|cook|heat)/gi, (match, adj, verb) => {
    return `${verb} until ${adj}`;
  });
  
  // "on medium heat fry" -> "fry on medium heat"
  result = result.replace(/(on\s+\w+\s+heat)\s+(fry|bake|cook)/gi, (match, heatPhrase, verb) => {
    return `${verb} ${heatPhrase}`;
  });
  
  // 6. 대소문자 정리 (문장 첫 글자 대문자)
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  
  // 7. 불필요한 공백 다시 제거
  result = result.replace(/\s+/g, ' ').trim();
  
  // 8. 마침표 추가 (없으면)
  if (result && !result.match(/[.!?]$/)) {
    result += '.';
  }
  
  return result;
}

// ============================================
// 2단계: MyMemory API로 다듬기
// ============================================

// POST - 한글 조리법을 영문으로 번역 (2단계 로직)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // 한글이 없으면 그대로 반환
    const hasKorean = /[\uAC00-\uD7AF]/.test(text);
    if (!hasKorean) {
      return NextResponse.json({
        original: text,
        finalTranslation: text,
        usedAI: false
      });
    }

    // 1단계: 용어집 기반 치환
    const step1Result = applyTerminologyMapping(text);
    console.log('Step 1 (Terminology mapping):', step1Result);
    
    // 2단계: 문법 규칙 적용 (조사 제거 + 어순 조정)
    const step2Result = applyGrammarRules(step1Result);
    console.log('Step 2 (Grammar rules):', step2Result);
    
    // 3단계: 남은 한글이 있으면 MyMemory API로 번역
    const stillHasKorean = /[\uAC00-\uD7AF]/.test(step2Result);
    
    if (!stillHasKorean) {
      // 한글이 모두 처리됨
      return NextResponse.json({
        original: text,
        step1: step1Result,
        step2: step2Result,
        finalTranslation: step2Result,
        usedAI: false,
        provider: 'Rule-based only'
      });
    }

    // 3단계: MyMemory API로 최종 다듬기
    try {
      console.log('Step 3: MyMemory translation for remaining Korean...');
      
      const encodedText = encodeURIComponent(step2Result);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=ko|en`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          const translation = data.responseData.translatedText;
          
          if (translation && !translation.includes('MYMEMORY WARNING')) {
            console.log('Step 3 (MyMemory):', translation);
            return NextResponse.json({
              original: text,
              step1: step1Result,
              step2: step2Result,
              finalTranslation: translation,
              usedAI: true,
              provider: 'Hybrid (Rules + MyMemory)'
            });
          }
        }
      }
      
      // MyMemory 실패시 2단계 결과 반환
      console.warn('MyMemory failed, returning step 2 result');
      return NextResponse.json({
        original: text,
        step1: step1Result,
        step2: step2Result,
        finalTranslation: step2Result,
        usedAI: false,
        aiError: 'MyMemory translation failed, using rules only'
      });
    } catch (apiError: any) {
      console.error('MyMemory error:', apiError?.message);
      return NextResponse.json({
        original: text,
        step1: step1Result,
        step2: step2Result,
        finalTranslation: step2Result,
        usedAI: false,
        aiError: `API failed: ${apiError?.message}`
      });
    }
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
