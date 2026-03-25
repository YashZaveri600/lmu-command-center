import fs from 'fs'
import path from 'path'
import os from 'os'

const LMU_DIR = path.join(os.homedir(), 'Desktop', 'LMU Spring 2026')
const DATA_DIR = path.join(import.meta.dirname, '..', 'data')

const courseMap = {
  '1 - Managing People & Organizations': 'managing',
  '2 - Philosophical Inquiry': 'philosophy',
  '3 - Marketing & Business Communications': 'marketing',
  '4 - Managerial Accounting': 'accounting',
}

function scanFolder(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath).filter(f => !f.startsWith('.'))
}

function main() {
  if (!fs.existsSync(LMU_DIR)) {
    console.log(`LMU folder not found at: ${LMU_DIR}`)
    console.log('Make sure ~/Desktop/LMU Spring 2026/ exists.')
    process.exit(1)
  }

  const coursesPath = path.join(DATA_DIR, 'courses.json')
  const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'))

  const topLevelFolders = scanFolder(LMU_DIR)

  for (const folderName of topLevelFolders) {
    const courseId = courseMap[folderName]
    if (!courseId) continue

    const course = courses.find(c => c.id === courseId)
    if (!course) continue

    const coursePath = path.join(LMU_DIR, folderName)
    const subFolders = scanFolder(coursePath).filter(f =>
      fs.statSync(path.join(coursePath, f)).isDirectory()
    )

    course.folders = subFolders.map(sub => {
      const subPath = path.join(coursePath, sub)
      const files = scanFolder(subPath).filter(f =>
        fs.statSync(path.join(subPath, f)).isFile()
      )
      return { name: sub, files }
    })

    const totalFiles = course.folders.reduce((sum, f) => sum + f.files.length, 0)
    console.log(`  ${course.shortCode}: ${course.folders.length} folders, ${totalFiles} files`)
  }

  fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2))
  console.log('\nDone! courses.json updated with file tree.')
}

main()
