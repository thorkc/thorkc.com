document.querySelector('#trigger-deploy').onclick = () => {
    fetch('https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/db11de2a-54da-432a-b4f1-f0d343640670')
        .then(() => alert('Deploy triggered.'))
        .catch(() => alert('Deploy failed.'));
};
