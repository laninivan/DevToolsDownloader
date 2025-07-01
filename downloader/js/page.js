// обработка сохранения ресурса
// chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener(
//     callback: function,
//   )

// когда ресурс добавлен
// chrome.devtools.inspectedWindow.onResourceAdded.addListener(
//     callback: function,
//   )

const downloadButton = document.getElementById("downloadButton");

// -------------------------------------------------------------------------------------------------------------------------

function getCurrentDate() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Месяц начинается с 0
    const year = today.getFullYear();
    return `${day}.${month}.${year}`;
}

async function commitMultipleFilesInOneCommit(files) {
    const githubToken = "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";
    const repoOwner = "laninivan";
    const repoName = "FisSedThemeCSS";
    const branch = "main";

    const date = getCurrentDate();
    const commitMessage = `Хороший день ${date}!`;

    // 1. Получаем ссылку на ветку
    const refUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/git/refs/heads/${branch}`; 
    const refResponse = await fetch(refUrl, {
        headers: {
            "Authorization": `token ${githubToken}`,
            "Accept": "application/vnd.github.v3+json"
        }
    });
    const refData = await refResponse.json();
    const latestCommitSha = refData.object.sha;

    // 2. Получаем последний коммит
    const commitUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/git/commits/${latestCommitSha}`; 
    const commitResponse = await fetch(commitUrl, {
        headers: {
            "Authorization": `token ${githubToken}`,
            "Accept": "application/vnd.github.v3+json"
        }
    });
    const commitData = await commitResponse.json();

    const treeSha = commitData.tree.sha;
    const parentSha = commitData.sha;

    // 3. Создаём blob для каждого файла
    const blobs = [];

    for (const file of files) {
        // alert(file.path+' | '+file.content);
        const { path, content } = file;
         const encodedContent = content;

        const blobUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/git/blobs`; 
        const blobResponse = await fetch(blobUrl, {
            method: "POST",
            headers: {
                "Authorization": `token ${githubToken}`,
                "Content-Type": "application/json",
                "Accept":"application/vnd.github.v3.raw"
            },
            body: JSON.stringify({
                content: encodedContent,
                encoding: "utf-8"
            })
        });

        const blobData = await blobResponse.json();
        blobs.push({
            path,
            mode: "100644",
            type: "blob",
            sha: blobData.sha
        });
    }

    // 4. Создаём новое дерево (tree)
    const treeUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees`; 
    const treeResponse = await fetch(treeUrl, {
        method: "POST",
        headers: {
            "Authorization": `token ${githubToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            base_tree: treeSha,
            tree: blobs
        })
    });

    const treeData = await treeResponse.json();
    const newTreeSha = treeData.sha;

    // 5. Создаём новый коммит
    const newCommitUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/git/commits`; 
    const newCommitResponse = await fetch(newCommitUrl, {
        method: "POST",
        headers: {
            "Authorization": `token ${githubToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: commitMessage,
            tree: newTreeSha,
            parents: [parentSha]
        })
    });

    const newCommitData = await newCommitResponse.json();
    const newCommitSha = newCommitData.sha;

    // 6. Обновляем ветку
    const updateRefUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/git/refs/heads/${branch}`; 
    const updateRefResponse = await fetch(updateRefUrl, {
        method: "PATCH",
        headers: {
            "Authorization": `token ${githubToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            sha: newCommitSha,
            force: true
        })
    });

    const result = await updateRefResponse.json();
    alert("Все файлы успешно закоммичены:");
}


// ----------------------------------------------------------------------------------------------------------

downloadButton.onclick = async function () {
    downloadButton.disabled = true;
    try {
        const resources = await new Promise((resolve) => {
            chrome.devtools.inspectedWindow.getResources(resolve);
        });
        await createAndDownloadArchive(resources);
    } catch (error) {
        console.error(error);
    } finally {
        downloadButton.disabled = false; 
    }
};



function getResourceContent(resource) {
    return new Promise((resolve, reject) => {
        resource.getContent((content) => {
            if (content) {
                let path = resource.url.includes('path=')
                    ? resource.url.split('path=')[1].replaceAll('%2F', '/')
                    : resource.url.replaceAll('%2F', '/');
                resolve({ path, content });
            } else {
                reject(new Error('Ошибка получения контента ресурса: ' + resource.url));
            }
        });
    });
}



async function createAndDownloadArchive(resources) {
    const zip = new JSZip(); 
    // Фильтруем ресурсы, связанные с "themes"
  
    const themeResources = resources.filter(resource => resource.url.includes('themes'));           //поиск ресурсов по подстроке

    try {
        const jsonData = {
            name: 'halva',
            ext_button: {
                LabelUpperCase: false
            },
            _buttonset: {
                LabelUpperCase: false
            }
        };
        const jsonString = JSON.stringify(jsonData, null, 2);

        const files = await Promise.all(themeResources.map(getResourceContent));

        files.push({path:'theme.json',content: jsonString});

        commitMultipleFilesInOneCommit(files);      

        files.forEach(({ path, content }) => {
            zip.file(path, content);
        });
       
        // Генерация архива и скачивание
        const archiveContent = await zip.generateAsync({ type: "blob" });

        saveAs(archiveContent, "archive.zip");
    } catch (error) {
        console.error('Ошибка при создании архива:', error);
    }
}

