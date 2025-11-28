const TESTS_KEY = 'ma_tests'

export function loadTests(){
  const raw = localStorage.getItem(TESTS_KEY)
  if(!raw) return []
  return JSON.parse(raw)
}

export function saveTests(tests){
  localStorage.setItem(TESTS_KEY, JSON.stringify(tests))
}

export function seedTests(){
  if(localStorage.getItem(TESTS_KEY)) return
  const now = new Date()
  // create 8 weekly tests across 2 months
  const tests = []
  const subjects = ['Fiqh','Seerat','Stories','LiteratureWork']
  for(let i=0;i<8;i++){
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i*7)
    const marks = {}
    subjects.forEach((s)=>{
      // generate obtained and total values
      const total = 100
      const obtained = Math.floor(50 + Math.random()*50)
      marks[s] = { obtained, total }
    })
    tests.push({ id: i+1, date: date.toISOString(), marks })
  }
  saveTests(tests)
}
